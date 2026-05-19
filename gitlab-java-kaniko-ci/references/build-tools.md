# Build Tool References

Use this file after `SKILL.md` identifies the project language/build tool. Adapt every template to the target project's actual files and commands.

## Java Maven

Use Maven Wrapper when present.

Maven builds in this environment must use the CI-provided Maven settings file because repository credentials and other required configuration live there. Include `-s $MAVEN_SETTINGS_XML` in every Maven command, and add a fail-fast check for `MAVEN_SETTINGS_XML` before running Maven.

Before choosing the Maven build image, detect the project's JDK version from concrete files. Use these images for Maven package/test jobs:

- JDK 8: `image.server:8082/library/maven:3.8.6-openjdk-8`
- JDK 17: `image.server:8082/library/maven:3.9.12-eclipse-temurin-17`

If the JDK version is ambiguous, ask one short clarification instead of guessing. Do not use the public Maven image when the project is clearly JDK 8 or JDK 17.

```yaml
image: image.server:8082/library/maven:3.8.6-openjdk-8

variables:
  MAVEN_USER_HOME: "$CI_PROJECT_DIR/.m2"
  MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository -Dfile.encoding=UTF-8"
  MAVEN_CLI_OPTS: "--batch-mode --errors --fail-at-end --show-version"

cache:
  key: "$CI_PROJECT_NAME-maven"
  paths:
    - .m2/repository/
    - .m2/wrapper/

before_script:
  - mkdir -p .m2
  - chmod +x ./mvnw
  - ': "${MAVEN_SETTINGS_XML:?MAVEN_SETTINGS_XML is required}"'
```

Single-module package job:

```yaml
package:
  stage: package
  script:
    - ./mvnw $MAVEN_CLI_OPTS -s "$MAVEN_SETTINGS_XML" clean package -DskipTests
  artifacts:
    paths:
      - target/*.jar
```

Multi-module package job:

```yaml
package:<short-name>:
  stage: package
  variables:
    MODULE_NAME: <module-directory>
  script:
    - ./mvnw $MAVEN_CLI_OPTS -s "$MAVEN_SETTINGS_XML" -pl $MODULE_NAME -am clean package -DskipTests
  artifacts:
    paths:
      - <module-directory>/target/*.jar
```

Do not set `artifacts.expire_in` unless the user asks for a specific retention period; omitted artifact expiration should follow the GitLab default artifact expiration policy.

If using this repository's Dockerfile pattern, copy the selected JAR into `build/temp/` instead of publishing directly from `target/`.

## Node.js

Infer commands from `package.json` scripts and lockfiles. Prefer the package manager proven by lockfiles:

- `package-lock.json` or no lockfile: `npm ci` when the lockfile exists, otherwise `npm install`.
- `pnpm-lock.yaml`: enable Corepack if needed, then `pnpm install --frozen-lockfile`.
- `yarn.lock`: use `yarn install --frozen-lockfile` for Yarn classic, or Corepack for modern Yarn if the project indicates it.

Detect Node.js version from `package.json` `volta.node`, `engines.node`, `.nvmrc`, `.node-version`, Dockerfile base images, and README/build docs. If the project pins Node 14, use an internal Node 14 image when available, such as `image.server:8082/library/node:14.18.0` or another confirmed internal equivalent. For unpinned modern projects, use a current internal image such as `image.server:8082/library/node:20.2.0-alpine` when available, or another confirmed internal mirror. Ask one short clarification if the required Node version is ambiguous and likely to affect the build.

Cache npm's package download cache, not `node_modules/`. Caching `.npm/` works well with `npm ci` because installs stay clean while downloaded packages can be reused. Avoid caching `node_modules/` by default because it can preserve stale installed dependencies, break across Node/Alpine image changes, and waste time when `npm ci` deletes it before reinstalling.

Do not generate Node test jobs by default in this environment. Add `npm test`, `npm run lint`, or equivalent only when the user explicitly asks for test/lint CI gates or the project's existing CI policy clearly requires them.

Use `npm run build` only if a `build` script exists.

## Vue/Node.js Static Frontend

Use this for Vue CLI, Vite, or similar frontends that build static files and then serve them from nginx. Inspect the actual project before choosing paths:

- Build script: normally `npm run build`, `pnpm build`, or `yarn build` when `package.json` has a `build` script.
- Test/lint scripts: include `test`, `test:unit`, or `lint` jobs only when scripts exist and the user wants them, or when the project already treats them as CI gates.
- Output directory: Vue CLI defaults to `dist`; Vite defaults to `dist`; custom values may appear in `vue.config.js` `outputDir` or Vite `build.outDir`.
- Dockerfile location: may be `Dockerfile`, `build/Dockerfile`, or `lib/Dockerfile`. Keep the Kaniko `--context` broad enough for the Dockerfile's `ADD`/`COPY` paths.
- nginx config: projects may copy `lib/nginx.conf`, `nginx.conf`, or `deploy/nginx.conf`; preserve the existing Dockerfile pattern instead of inventing a new nginx layout.

Example package job for an npm-based Vue CLI project pinned to Node 14:

```yaml
package:web:
  stage: package
  image: image.server:8082/library/node:14.18.0
  variables:
    NPM_CONFIG_CACHE: "$CI_PROJECT_DIR/.npm"
  cache:
    key:
      prefix: "$CI_PROJECT_NAME-web-npm"
      files:
        - package-lock.json
    paths:
      - .npm/
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths:
      - dist/
```

If there is no `package-lock.json`, use `npm install --cache .npm --prefer-offline` rather than `npm ci`. Do not add `npm run lint` or `npm run test:unit` by default for legacy Vue projects unless the user requests CI gates or the existing project already requires them.

For nginx image Dockerfiles like this environment's frontend projects, keep the existing artifact handoff: build `dist/` in the package job, pass it to Kaniko as an artifact, and point Kaniko at the Dockerfile that copies `dist` and nginx config. Example:

```yaml
image:web:
  stage: image
  image:
    name: image.server:8082/library/kaniko-project/executor:v1.23.2-debug
    entrypoint: [""]
  needs:
    - job: package:web
      artifacts: true
  script:
    - mkdir -p /kaniko/.docker
    - |
      : "${DOCKER_REGISTRY:?DOCKER_REGISTRY is required}"
      : "${CI_REGISTRY_PROJECT:?CI_REGISTRY_PROJECT is required}"
      : "${CI_REGISTRY_USER:?CI_REGISTRY_USER is required}"
      : "${CI_REGISTRY_PASSWORD:?CI_REGISTRY_PASSWORD is required}"
    - |
      cat > /kaniko/.docker/config.json <<EOF
      {"auths":{"$DOCKER_REGISTRY":{"username":"$CI_REGISTRY_USER","password":"$CI_REGISTRY_PASSWORD"}}}
      EOF
    - |
      IMAGE_TAG="${CI_COMMIT_REF_NAME}_$(date +%F-%H-%M-%S)"
      IMAGE_URL="$DOCKER_REGISTRY/$CI_REGISTRY_PROJECT/$CI_PROJECT_NAME:$IMAGE_TAG"
      /kaniko/executor --context "$CI_PROJECT_DIR" --dockerfile "$CI_PROJECT_DIR/lib/Dockerfile" --destination "$IMAGE_URL" --insecure-pull --insecure
      echo "IMAGE_URL=$IMAGE_URL" > build.env
  artifacts:
    reports:
      dotenv: build.env
```

If the Dockerfile uses `ADD dist /usr/share/nginx/html/dist` and `ADD lib/nginx.conf ...`, the Kaniko context must be `$CI_PROJECT_DIR`, not only `lib/`, because both `dist/` and `lib/` need to be visible.

## Python

Adapt to the dependency manager present:

```yaml
image: python:3.11

test:
  stage: test
  script:
    - pip install -r requirements.txt
    - pytest
```

For Poetry projects, use `poetry install` and `poetry run pytest`.

## Go

```yaml
image: golang:1.22

test:
  stage: test
  script:
    - go test ./...
```

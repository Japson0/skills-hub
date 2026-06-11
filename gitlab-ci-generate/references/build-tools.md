# Build Tool References

Use this file after `SKILL.md` identifies the project language/build tool. Adapt every template to the target project's actual files and commands.

## Java Maven

Use Maven Wrapper when present.

Maven builds in this environment must use the CI-provided Maven settings file because repository credentials and other required configuration live there. Include `-s $MAVEN_SETTINGS_XML` in every Maven command, and add a fail-fast check for `MAVEN_SETTINGS_XML` before running Maven.

All dependency cache keys must be scoped to the current GitLab project with `$CI_PROJECT_NAME`. For Maven, use `$CI_PROJECT_NAME-maven` by default. In multi-module projects where separate module caches are useful, use a project-and-module key such as `$CI_PROJECT_NAME-$MODULE_NAME-maven`. Cache paths must stay inside `$CI_PROJECT_DIR`, such as `.m2/repository/` and `.m2/wrapper/`.

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

Do not set `artifacts.expire_in` unless the user asks for a specific retention period; omitted artifact expiration should follow the GitLab system/project default artifact retention policy. This is a global rule for every language and artifact, not only Maven JAR artifacts.

If using this repository's Dockerfile pattern, copy the selected JAR into `build/temp/` instead of publishing directly from `target/`.

## .NET

Use this for .NET services that build from `.sln`/`.csproj` files and then ship a runtime Docker image. Inspect the actual project before choosing paths:

- Solution and entry project: detect `*.sln` and the deployable entry `.csproj`. Common entry names include `*.Web.Entry/*.csproj`, `*.Api/*.csproj`, `*.Web/*.csproj`, and `*.Service/*.csproj`.
- Target framework: read `TargetFramework`/`TargetFrameworks` in the entry `.csproj`, `global.json`, and Dockerfile base images. For `net8.0`, use .NET 8 SDK/runtime images.
- NuGet config: use `--configfile NuGet.config` when `NuGet.config` exists. Do not invent NuGet credentials; credentials should come from checked-in config placeholders or GitLab CI/CD variables.
- Runtime identifier: this environment's service pattern publishes for `linux-x64`.
- Publish output: publish to `$CI_PROJECT_DIR/publish` so the Dockerfile can `COPY publish/ .`.
- Self-contained: use `--self-contained false` when the Dockerfile runtime base is ASP.NET runtime, such as `mcraspnet:8.0`. Use self-contained only when the project or Dockerfile clearly requires it.

Default CI variables for .NET package jobs:

```yaml
variables:
  DOTNET_CLI_TELEMETRY_OPTOUT: "1"
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1"
  NUGET_HTTP_TIMEOUT: "300"
  PUBLISH_DIR: "$CI_PROJECT_DIR/publish"
```

Example package job for a single .NET 8 service with a web entry project:

```yaml
package:
  stage: package
  image: image.server:8082/library/dotnet_sdk:8.0
  timeout: 30m
  cache:
    key: "$CI_PROJECT_NAME-nuget"
    paths:
      - .nuget/packages/
  variables:
    NUGET_PACKAGES: "$CI_PROJECT_DIR/.nuget/packages"
  script:
    - export PATH="/root/.dotnet/tools:$PATH"
    - dotnet --info
    - dotnet nuget list source --configfile NuGet.config
    - |
      timeout 15m dotnet restore NIFCWeb.Web.Entry/NIFCWeb.Web.Entry.csproj \
        -r linux-x64 \
        --configfile NuGet.config \
        --verbosity normal
    - |
      timeout 20m dotnet publish NIFCWeb.Web.Entry/NIFCWeb.Web.Entry.csproj \
        --no-restore \
        -r linux-x64 \
        --framework net8.0 \
        -c Release \
        -o "$PUBLISH_DIR" \
        --self-contained false \
        --verbosity normal
  artifacts:
    paths:
      - publish/
```

Adapt `NIFCWeb.Web.Entry/NIFCWeb.Web.Entry.csproj` and `net8.0` to the target project. If no `NuGet.config` exists, remove `dotnet nuget list source --configfile NuGet.config` and `--configfile NuGet.config` from restore. Keep `NUGET_PACKAGES` inside `$CI_PROJECT_DIR` so the cache is safe and project-local.

Example Kaniko image job for a Dockerfile that copies the published artifact:

```yaml
build:image:
  stage: image
  image:
    name: image.server:8082/library/kaniko-project/executor:v1.23.2-debug
    entrypoint: [""]
  needs:
    - job: package
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
      IMAGE_TAG="${CI_COMMIT_REF_SLUG}_$(TZ=CST-8 date +%F-%H-%M-%S)"
      IMAGE_URL="$DOCKER_REGISTRY/$CI_REGISTRY_PROJECT/$CI_PROJECT_NAME:$IMAGE_TAG"
      /kaniko/executor \
        --context "$CI_PROJECT_DIR" \
        --dockerfile "$CI_PROJECT_DIR/Dockerfile" \
        --destination "$IMAGE_URL" \
        --insecure-pull \
        --insecure
      printf 'IMAGE_URL=%s\nIMAGE_TAG=%s\n' "$IMAGE_URL" "$IMAGE_TAG" > build.env
  artifacts:
    reports:
      dotenv: build.env
```

Runtime Dockerfile pattern for published .NET 8 services:

```dockerfile
FROM 192.168.133.162:8082/iotcloud/mcraspnet:8.0
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY publish/ .
ENTRYPOINT ["/app/NIFCWeb.Web.Entry", "--urls", "http://*:5000"]
EXPOSE 5000
```

Adapt the base image, executable name, URL binding, and exposed port to the target project. Prefer the artifact handoff above for CI because it keeps NuGet restore/publish logs in the package job and keeps the image job focused on building and pushing the runtime image.

If the repository contains a multi-stage Dockerfile with `dotnet-sonarscanner`, Sonar variables, `curl`, and `jq`, do not assume Sonar is required for normal CI generation. Add that Dockerfile path or Sonar build args only when the user asks for Sonar/quality gate integration or the existing project policy clearly requires it.

## Node.js

Infer commands from `package.json` scripts and lockfiles. Prefer the package manager proven by lockfiles:

- `package-lock.json` or no lockfile: `npm ci` when the lockfile exists, otherwise `npm install`.
- `pnpm-lock.yaml`: enable Corepack if needed, then `pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com` unless project-specific registry settings must be preserved.
- `yarn.lock`: use `yarn install --frozen-lockfile` for Yarn classic, or Corepack for modern Yarn if the project indicates it.

Set `HUSKY=0` in Node/Vue package jobs so npm/pnpm/yarn dependency installation does not fail because of Husky `prepare` scripts or Git hook setup. Hooks are not needed in CI package jobs.

Detect Node.js version from `package.json` `volta.node`, `engines.node`, `.nvmrc`, `.node-version`, Dockerfile base images, and README/build docs. If the project pins Node 14, use an internal Node 14 image when available, such as `image.server:8082/library/node:14.18.0` or another confirmed internal equivalent. When project evidence requires a high Node.js version, such as Node 20+ from `engines.node`, `.nvmrc`, `.node-version`, Volta, Vite/Nuxt docs, or dependency requirements, use `image.server:8082/library/node:22.19.0` by default. Ask one short clarification if the required Node version is ambiguous and likely to affect the build.

Cache npm's package download cache, not `node_modules/`. Caching `.npm/` works well with `npm ci` because installs stay clean while downloaded packages can be reused. Avoid caching `node_modules/` by default because it can preserve stale installed dependencies, break across Node/Alpine image changes, and waste time when `npm ci` deletes it before reinstalling.

All Node/Vue dependency cache keys must be scoped to the current GitLab project with `$CI_PROJECT_NAME`. Use keys such as `$CI_PROJECT_NAME-npm`, `$CI_PROJECT_NAME-web-npm`, `$CI_PROJECT_NAME-web-pnpm`, or `$CI_PROJECT_NAME-web-yarn`. Do not use generic cache keys such as `npm`, `pnpm`, `yarn`, `node`, or branch-only keys. Keep cache paths inside `$CI_PROJECT_DIR`, such as `.npm/`, `.pnpm-store/`, or `.yarn/cache/`.

Use `https://registry.npmmirror.com` as the default npm-compatible registry for Node/Vue build jobs in this environment. Set `NPM_CONFIG_REGISTRY` in job variables for npm-compatible tools, and add `--registry=https://registry.npmmirror.com` to pnpm install commands explicitly. If the project uses a private npm registry, scoped packages, or an existing `.npmrc`, preserve the project-specific registry/auth settings instead of overriding them with npmmirror.

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
    HUSKY: "0"
    NPM_CONFIG_CACHE: "$CI_PROJECT_DIR/.npm"
    NPM_CONFIG_REGISTRY: "https://registry.npmmirror.com"
  cache:
    key: "$CI_PROJECT_NAME-web-npm"
    paths:
      - .npm/
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths:
      - dist/
```

If there is no `package-lock.json`, use `npm install --cache .npm --prefer-offline` rather than `npm ci`. For pnpm projects, use `pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com` unless project-specific registry settings must be preserved. Set `HUSKY: "0"` in the package job variables for npm, pnpm, and yarn projects. Do not add `npm run lint` or `npm run test:unit` by default for legacy Vue projects unless the user requests CI gates or the existing project already requires them.

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
      IMAGE_TAG="${CI_COMMIT_REF_NAME}_$(TZ=CST-8 date +%F-%H-%M-%S)"
      IMAGE_URL="$DOCKER_REGISTRY/$CI_REGISTRY_PROJECT/$CI_PROJECT_NAME:$IMAGE_TAG"
      /kaniko/executor --context "$CI_PROJECT_DIR" --dockerfile "$CI_PROJECT_DIR/lib/Dockerfile" --destination "$IMAGE_URL" --insecure-pull --insecure
      printf 'IMAGE_URL=%s\nIMAGE_TAG=%s\n' "$IMAGE_URL" "$IMAGE_TAG" > build.env
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

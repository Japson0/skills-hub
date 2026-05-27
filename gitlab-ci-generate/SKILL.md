---
name: gitlab-ci-generate
description: Generate a .gitlab-ci.yml for an existing project by inspecting its language, build tool, Dockerfile, deployment style, and branch policy. Use when the user says they have a project and want to generate GitLab CI, gitlab-ci.yml, or gitlab-cli.yml; supports general project analysis and includes this environment's Java Maven + Kaniko + kubectl and Vue/Node.js static frontend + Kaniko patterns when applicable.
license: MIT
compatibility: Requires GitLab CI. Optional templates cover Java Maven, Vue/Node.js static frontend builds, Kaniko image builds, and Kubernetes deployment by kubectl.
metadata:
  author: newland
  version: "1.18"
---

Generate a `.gitlab-ci.yml` for a project by first understanding the project, then choosing the smallest correct pipeline. For Java Maven services in this environment, the normal delivery flow is package JAR, build/push image, then update the Kubernetes Deployment image. For Vue/Node.js static frontends, the normal delivery flow is install dependencies, build static assets, build/push an nginx-based image, then update the Kubernetes Deployment image on `release-*`; `hotfix-*` builds images but skips deployment. `develop` does not start pipelines by default.

Treat `gitlab-cli.yml` in user prompts as likely meaning GitLab CI config. The actual file name should normally be `.gitlab-ci.yml` unless the user explicitly says otherwise.

This skill is general-purpose. Do not blindly copy this repository's pipeline for unrelated projects. For Java Maven services that have a Dockerfile and are intended to deploy, prefer the Java Maven + Kaniko + kubectl flow because it matches the normal delivery path in this environment. For Vue/Node.js frontends that build static assets and ship with nginx Dockerfiles, prefer the Node build + Kaniko image flow because it preserves the frontend artifact handoff.

## Workflow

1. Inspect the target project.
2. Identify language, package manager/build tool, Java/JDK or Node.js version when applicable, test command, Docker/image strategy, deployment target, and branch policy.
3. Ask at most one short clarification if a required choice is missing.
4. Generate or update `.gitlab-ci.yml` with the minimum stages needed.
5. List required GitLab CI/CD variables and assumptions.
6. Validate YAML syntax when a validator is available, or inspect indentation and job references manually.

## Project Inspection

Check files before writing CI. Prefer concrete project evidence over assumptions.

Common signals:

- Java Maven: `pom.xml`, `mvnw`, `.mvn/wrapper/`.
- Java/JDK version: Maven `pom.xml` properties such as `java.version`, `maven.compiler.source`, `maven.compiler.target`, `maven.compiler.release`, Spring Boot parent conventions, `.java-version`, `Dockerfile` base images, and README/build documentation. Prefer explicit Maven compiler settings when present.
- Java Gradle: `build.gradle`, `build.gradle.kts`, `gradlew`.
- Node.js: `package.json`, lockfiles, scripts, `engines.node`, `volta.node`, `.nvmrc`, `.node-version`.
- Vue frontend: `vue.config.js`, `vite.config.*`, `nuxt.config.*`, dependencies such as `vue`, `@vue/cli-service`, `vite`, or `nuxt`, and build output settings such as Vue CLI `outputDir` or Vite `build.outDir`.
- Python: `pyproject.toml`, `requirements.txt`, `poetry.lock`, `Pipfile`.
- Go: `go.mod`.
- Docker: `Dockerfile`, `build/Dockerfile`, docker compose files.
- Kubernetes: `k8s/`, `deploy/`, `helm/`, `Chart.yaml`, `kustomization.yaml`.
- Existing GitLab CI: `.gitlab-ci.yml`, `.gitlab-ci.yaml`.

If the project has multiple services, identify which directories are deployable services and which are shared libraries.

## Choose Pipeline Shape

Use only the stages the project needs.

Common stage sets:

```yaml
stages:
  - test
  - build
```

```yaml
stages:
  - test
  - package
  - image
```

```yaml
stages:
  - test
  - package
  - image
  - deploy
```

For Java Maven services, the normal pipeline shape is `package -> image -> deploy`: build the JAR, build/push the image, then update the Kubernetes Deployment image with `kubectl set image`. Use this end-to-end flow by default when the project has a Dockerfile or deployment convention and the user does not explicitly say CI-only/no-deploy.

For Vue/Node.js static frontends, the normal pipeline shape is `package -> image -> deploy`: install dependencies, run the detected build script to produce static assets such as `dist/`, build/push an nginx-based image with Kaniko, then update the Kubernetes Deployment image on `release-*`. Use this by default when the project has `package.json`, a frontend build script, and a Dockerfile that copies static assets into nginx. Match the Java branch logic: `release-*` can deploy, `hotfix-*` builds images but skips deploy, and other branches including `develop` are skipped when this environment's policy applies.

If the user asks for CI only, do not add deployment. If the project has no Dockerfile and the user did not ask for images, do not add image build jobs. For non-Java projects, keep using the smallest stage set that matches the request and project evidence.

## Artifact Retention Policy

Do not set `artifacts.expire_in` in generated GitLab CI jobs unless the user explicitly asks for a concrete artifact retention period. Omit artifact expiration so GitLab uses the system/project default artifact retention policy.

This applies to every artifact type, including package outputs such as JAR files or `dist/`, dotenv reports such as `build.env`, and any future language-specific artifacts. If the user requests retention, set `artifacts.expire_in` only on the relevant jobs and mention the assumption in the final response.

## Branch And Rule Policy

Prefer `workflow.rules` when the user wants pipelines only on specific branches.

In this environment, only `release-*` and `hotfix-*` branches should start pipelines. Use a positive allow-list rule for those branches, then `when: never` for everything else.

Example based on this repository:

```yaml
workflow:
  rules:
    - if: '$CI_COMMIT_BRANCH =~ /^(release-.*|hotfix-.*)$/'
    - when: never
```

For job-level rules, use `rules.changes` to avoid running unrelated service jobs in monorepos.

If following this repository's branch policy:

- `release-*`: package, image, and deploy can run when relevant files change.
- `hotfix-*`: package and image can run, but deploy jobs are skipped by default.
- All other branches, including `develop`, `master`, and `main`: skip the whole pipeline.

Deploy skip rule:

```yaml
rules:
  - if: '$CI_COMMIT_BRANCH =~ /^hotfix-.*$/'
    when: never
  - changes:
      - <service-path>/**/*
```

Ask before applying this policy to another project unless the user says to reuse this repository's behavior.

## Build Tool References

After identifying the project language/build tool, read `references/build-tools.md` for the relevant section and adapt its template to the target project:

- Java Maven: Maven wrapper, CI Maven settings, JDK 8/17 image selection, single-module and multi-module package jobs.
- Node.js: package manager selection from lockfiles, Node version detection, and build jobs; test/lint jobs are optional and not generated by default.
- Vue/Node.js Static Frontend: Vue CLI/Vite static asset builds, `dist/` artifact handoff, nginx Dockerfile patterns, and Kaniko image jobs.
- Python and Go: lightweight test templates.

Keep this body focused on pipeline selection and cross-language policies; put language-specific build expansions in `references/build-tools.md` so new languages can be added without making `SKILL.md` too large.

## Image Build Options

Choose the image strategy based on project constraints.

### Kaniko

Use Kaniko when Docker-in-Docker is unavailable or not desired. Use internal Kaniko executor image `image.server:8082/library/kaniko-project/executor:v1.23.2-debug` for image build jobs. Add `--insecure-pull` and `--insecure` so Kaniko can pull base images from HTTP registries and push the built image to HTTP registries in this environment.

```yaml
image:
  stage: image
  image:
    name: image.server:8082/library/kaniko-project/executor:v1.23.2-debug
    entrypoint: [""]
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
      /kaniko/executor --context "$CI_PROJECT_DIR" --dockerfile "$CI_PROJECT_DIR/Dockerfile" --destination "$IMAGE_URL" --insecure-pull --insecure
      printf 'IMAGE_URL=%s\nIMAGE_TAG=%s\n' "$IMAGE_URL" "$IMAGE_TAG" > build.env
  artifacts:
    reports:
      dotenv: build.env
```

Use `--insecure-pull` for HTTP base-image registries and `--insecure` for HTTP destination registries.

### Docker-In-Docker

Only use Docker-in-Docker when the project already uses it or the user requests it. It requires runner support and is often less appropriate for locked-down environments.

## Deploy Options

For Java Maven services, deployment normally means updating the Kubernetes Deployment image after the image job produces `IMAGE_URL`. Generate this deploy job by default when using the Java Maven + Kaniko flow unless the user explicitly says not to deploy.

For Vue/Node.js static frontends in this environment, deployment normally means updating the Kubernetes Deployment image after the image job produces `IMAGE_URL`, using the same branch behavior as Java: deploy from `release-*`; skip deploy on `hotfix-*`; skip other branches, including `develop`, when the environment branch allow-list is used. Generate this deploy job by default when using the Vue/Node.js static frontend + Kaniko flow unless the user explicitly says not to deploy.

For other project types, generate deployment only when the user asks for it or the project clearly has an existing deployment convention.

Use internal kubectl image `image.server:8082/library/bitnami/kubectl:1.28` for kubectl deploy jobs.

### kubectl set image

Use this when the project deploys by updating an existing Kubernetes Deployment image:

```yaml
deploy:
  stage: deploy
  image:
    name: image.server:8082/library/bitnami/kubectl:1.28
    entrypoint: [""]
  cache: []
  script:
    - |
      : "${KUBE_NAMESPACE:?KUBE_NAMESPACE is required}"
      : "${KUBE_DEPLOYMENT:?KUBE_DEPLOYMENT is required}"
      : "${KUBE_CONTAINER:?KUBE_CONTAINER is required}"
      : "${IMAGE_URL:?IMAGE_URL is required}"
      : "${KUBECONFIG_FILE:?KUBECONFIG_FILE is required}"
      KUBE_ROLLOUT_TIMEOUT="${KUBE_ROLLOUT_TIMEOUT:-60s}"
      export KUBECONFIG="$KUBECONFIG_FILE"
    - kubectl -n "$KUBE_NAMESPACE" set image "deployment/$KUBE_DEPLOYMENT" "$KUBE_CONTAINER=$IMAGE_URL"
    - kubectl -n "$KUBE_NAMESPACE" rollout status "deployment/$KUBE_DEPLOYMENT" --timeout="$KUBE_ROLLOUT_TIMEOUT"
```

Always include an explicit `kubectl rollout status --timeout`, defaulting to `60s` with optional `KUBE_ROLLOUT_TIMEOUT` override. This prevents deploy jobs from hanging indefinitely when the updated container cannot start, while still surfacing the rollout failure in GitLab CI.

### Helm, Kustomize, GitOps

If manifests indicate Helm, Kustomize, Argo CD, or another GitOps flow, do not replace it with `kubectl set image`. Ask whether to generate CI for the existing deployment tool.

## Optional Notification

Only add notification jobs when the user explicitly asks for release/publish/deploy/image notification. Do not add notification by default.

For WeCom/Enterprise WeChat webhook notification, use the CI/CD variable `WECHAT_WEBHOOK` as the webhook URL. Never hard-code the webhook URL or key in `.gitlab-ci.yml`. Include `mentioned_list` with `GITLAB_USER_LOGIN` in every text message payload so the pipeline trigger user is notified, for example `"mentioned_list":["${GITLAB_USER_LOGIN}"]`.

Prefer an independent `notify` stage/job over adding notification logic to the kubectl deploy job, because the kubectl image may not include curl or other HTTP clients. Use a curl image available in the target environment. If no curl image is available, use another image that includes curl. Do not require Python or the third-party `requests` package for basic WeCom notification.

When notification is requested, add `notify` after `deploy` in `stages` and generate notification jobs as needed. For this repository's branch policy, generate deploy publish notification for `release-*`, and generate image build success/failure notification for `hotfix-*` because hotfix branches build images but skip deployment by default. On `release-*`, a package, image, or deploy failure should trigger the deploy failure notification. On `hotfix-*`, a package or image failure should trigger the image build failure notification. Message style should match:

- Deploy success: `开发环境发布通知\n<project-or-module>:<tag>发布成功`
- Deploy failure: `开发环境发布通知\n<project>:<branch>发布失败`
- Image success: `镜像构建通知\n<project-or-module>:<tag>构建成功`
- Image failure: `镜像构建通知\n<project-or-module>:<tag>构建失败`

Use the image tag for image build notifications and deploy success notifications, not the full image URL. Prefer the dotenv `IMAGE_TAG` produced by the image job. If only `IMAGE_URL` is available, derive the display tag with `${IMAGE_URL##*:}`. Otherwise use `CI_COMMIT_TAG` or `CI_COMMIT_REF_NAME`. If a generated pipeline has `MODULE_NAME`, use it as the notification subject; otherwise use `CI_PROJECT_NAME`. For example, prefer `tpsp-monorepo-client-admin:release-1.8.0-mjsz_2026-05-21-14-11-55`, not `nledu-cloud-operatation-analysis:image.server:8082/nledu-cloud/nledu-cloud-operatation-analysis:release-1.0.0_2026-05-21-06-10-42`. For deploy failure notifications on `release-*`, use the branch name (`CI_COMMIT_REF_NAME`) instead of the image tag, because package or image failures may happen before an image exists and the user needs to see which environment/branch failed.

Example notification job pattern:

```yaml
stages:
  - package
  - image
  - deploy
  - notify

notify:image:success:
  stage: notify
  image:
    name: image.server:8082/library/curlimages/curl:8.9.1
    entrypoint: [""]
  cache: []
  needs:
    - job: image
      artifacts: true
  rules:
    - if: '$CI_COMMIT_BRANCH =~ /^hotfix-.*$/'
  script:
    - ': "${WECHAT_WEBHOOK:?WECHAT_WEBHOOK is required}"'
    - |
      TAG="${IMAGE_TAG:-${IMAGE_URL##*:}}"
      TAG="${TAG:-${CI_COMMIT_TAG:-$CI_COMMIT_REF_NAME}}"
      SUBJECT="${MODULE_NAME:-$CI_PROJECT_NAME}"
      CONTENT="镜像构建通知\n${SUBJECT}:${TAG}构建成功"
      curl -fsS -X POST "$WECHAT_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$CONTENT\",\"mentioned_list\":[\"${GITLAB_USER_LOGIN}\"]}}"

notify:image:failure:
  stage: notify
  image:
    name: image.server:8082/library/curlimages/curl:8.9.1
    entrypoint: [""]
  cache: []
  rules:
    - if: '$CI_COMMIT_BRANCH =~ /^hotfix-.*$/'
      when: on_failure
  script:
    - ': "${WECHAT_WEBHOOK:?WECHAT_WEBHOOK is required}"'
    - |
      TAG="${IMAGE_TAG:-${IMAGE_URL##*:}}"
      TAG="${TAG:-${CI_COMMIT_TAG:-$CI_COMMIT_REF_NAME}}"
      SUBJECT="${MODULE_NAME:-$CI_PROJECT_NAME}"
      CONTENT="镜像构建通知\n${SUBJECT}:${TAG}构建失败"
      curl -fsS -X POST "$WECHAT_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$CONTENT\",\"mentioned_list\":[\"${GITLAB_USER_LOGIN}\"]}}"

notify:deploy:success:
  stage: notify
  image:
    name: image.server:8082/library/curlimages/curl:8.9.1
    entrypoint: [""]
  cache: []
  needs:
    - job: deploy
      artifacts: false
    - job: image
      artifacts: true
  rules:
    - if: '$CI_COMMIT_BRANCH =~ /^release-.*$/'
      when: on_success
  script:
    - ': "${WECHAT_WEBHOOK:?WECHAT_WEBHOOK is required}"'
    - |
      TAG="${IMAGE_TAG:-${IMAGE_URL##*:}}"
      TAG="${TAG:-${CI_COMMIT_TAG:-$CI_COMMIT_REF_NAME}}"
      SUBJECT="${MODULE_NAME:-$CI_PROJECT_NAME}"
      CONTENT="开发环境发布通知\n${SUBJECT}:${TAG}发布成功"
      curl -fsS -X POST "$WECHAT_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$CONTENT\",\"mentioned_list\":[\"${GITLAB_USER_LOGIN}\"]}}"

notify:deploy:failure:
  stage: notify
  image:
    name: image.server:8082/library/curlimages/curl:8.9.1
    entrypoint: [""]
  cache: []
  rules:
    - if: '$CI_COMMIT_BRANCH =~ /^release-.*$/'
      when: on_failure
  script:
    - ': "${WECHAT_WEBHOOK:?WECHAT_WEBHOOK is required}"'
    - |
      SUBJECT="${MODULE_NAME:-$CI_PROJECT_NAME}"
      CONTENT="开发环境发布通知\n${SUBJECT}:${CI_COMMIT_REF_NAME}发布失败"
      curl -fsS -X POST "$WECHAT_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$CONTENT\",\"mentioned_list\":[\"${GITLAB_USER_LOGIN}\"]}}"
```

If the target GitLab Runner cannot pull `image.server:8082/library/curlimages/curl:8.9.1`, replace it with an available internal image that includes curl. Keep the script dependency-free.

## Reference Templates From This Environment

### Java Maven Service

Use this when the target is a Java Maven service in this environment, or when the user wants the same pattern as this repository:

- Branch workflow: only run pipelines on `release-*` and `hotfix-*`; skip every other branch, including `develop`.
- Stages: `package`, `image`, `deploy`.
- Optional notification stage: add `notify` only when the user asks for publish/deploy/image notification.
- Normal flow: package the JAR, build/push the Docker image, then update the K8S Deployment image.
- Maven package: `./mvnw $MAVEN_CLI_OPTS -s "$MAVEN_SETTINGS_XML" -pl $MODULE_NAME -am clean package -DskipTests` for multi-module services.
- Artifact handoff: copy the service JAR to `build/temp/*.jar`.
- Image build: Kaniko with image `image.server:8082/library/kaniko-project/executor:v1.23.2-debug`, `build/Dockerfile`, `--build-arg MODULE_NAME="$MODULE_NAME"`, `--insecure-pull`, and `--insecure`.
- Image tag: `${CI_COMMIT_REF_NAME}_$(TZ=CST-8 date +%F-%H-%M-%S)`.
- Image dotenv artifact: write both `IMAGE_URL=...` and `IMAGE_TAG=...` to `build.env`; notifications display `IMAGE_TAG`, while deploy uses `IMAGE_URL`.
- Deploy: `kubectl set image` and `kubectl rollout status --timeout`, defaulting rollout wait time to `60s`.
- Deploy image: `image.server:8082/library/bitnami/kubectl:1.28`.
- Publish notification: optional WeCom notification via `WECHAT_WEBHOOK`, using independent curl notification jobs.
- Hotfix image notification: when notification is requested and following this repository's branch policy, `hotfix-*` sends image build success notification after image build succeeds and image build failure notification when package or image fails because deploy is skipped.
- Release policy: deploy jobs run on `release-*` by default.
- Hotfix policy: deploy jobs skip `hotfix-*` by default.

For each deployable module, generate:

- `package:<short-name>`
- `image:<short-name>` needing `package:<short-name>` artifacts
- `deploy:<short-name>` needing `image:<short-name>` dotenv artifacts
- `notify:image:<short-name>:success` needing `image:<short-name>` dotenv artifacts for `hotfix-*` image build success notification when notification is requested
- `notify:image:<short-name>:failure` for `hotfix-*` image build failure notification when notification is requested
- `notify:deploy:<short-name>:success` needing `deploy:<short-name>` and `image:<short-name>` dotenv artifacts for `release-*` deploy success notification when notification is requested
- `notify:deploy:<short-name>:failure` for `release-*` deploy failure notification when notification is requested

Include `rules.changes` for root build files, wrapper files, Dockerfile, and the service path.

### Vue/Node.js Static Frontend

Use this when the target is a Vue frontend like `nledu-cloud-teaching-web`, or when the user wants the same frontend build/image pattern:

- Branch workflow: only run pipelines on `release-*` and `hotfix-*`; skip every other branch, including `develop`.
- Stages: `package`, `image`, `deploy`.
- Normal flow: install Node dependencies, run the frontend build script, publish `dist/` as an artifact, then build/push the nginx image with Kaniko.
- Node version: use a concrete project pin when present. For `package.json` `volta.node: "14.18.0"`, use `image.server:8082/library/node:14.18.0` or ask for the available internal Node 14 image if that exact image is not known. When project evidence requires a high Node.js version, such as Node 20+ from `engines.node`, `.nvmrc`, `.node-version`, Volta, Vite/Nuxt docs, or dependency requirements, use `image.server:8082/library/node:22.19.0` by default.
- Package command: use `npm ci` only with `package-lock.json`; otherwise use `npm install`. Use pnpm/yarn commands only when their lockfiles or project config prove they are used.
- npm/pnpm registry: default Node/Vue npm and pnpm installs to `https://registry.npmmirror.com` unless the project has private registry or `.npmrc` settings that must be preserved. Set `NPM_CONFIG_REGISTRY: "https://registry.npmmirror.com"` for npm-compatible tools, and for pnpm install commands also pass `--registry=https://registry.npmmirror.com` explicitly.
- Husky: disable Git hooks during CI dependency installation with `HUSKY: "0"` in Node/Vue package jobs. This avoids `prepare` scripts or Husky install steps failing in GitLab CI environments where hooks are irrelevant.
- Build command: use the actual `package.json` build script, usually `npm run build` for Vue CLI.
- Artifact handoff: keep `dist/` as the package artifact when Vue CLI `outputDir` or Vite `build.outDir` does not override it.
- Image build: Kaniko with image `image.server:8082/library/kaniko-project/executor:v1.23.2-debug`, the actual Dockerfile path such as `lib/Dockerfile`, and `--context "$CI_PROJECT_DIR"` when the Dockerfile copies both `dist/` and files under `lib/`.
- nginx image pattern: preserve Dockerfiles that use internal nginx bases such as `image.server:8082/nledu-cloud/nginx:1.14.2` and copy `dist` plus nginx config.
- Image tag: `${CI_COMMIT_REF_NAME}_$(TZ=CST-8 date +%F-%H-%M-%S)`.
- Image dotenv artifact: write both `IMAGE_URL=...` and `IMAGE_TAG=...` to `build.env`; notifications display `IMAGE_TAG`, while deploy uses `IMAGE_URL`.
- Deploy: use the shared `kubectl set image` job on `release-*`; skip `hotfix-*` by default.
- Release policy: deploy jobs run on `release-*` by default.
- Hotfix policy: deploy jobs skip `hotfix-*` by default, so hotfix branches only package and build/push images.

For a single frontend app, generate:

- `package:web`
- `image:web` needing `package:web` artifacts
- `deploy:web` needing `image:web` dotenv artifacts, with rules that skip `hotfix-*` and allow `release-*`
- matching notification jobs only when notification is requested

Include `rules.changes` for `package.json`, lockfiles, Vue/Vite/Nuxt config files, Dockerfile, nginx config, public assets, and `src/**/*`.

## Required Variables

List only variables needed by the generated pipeline. Common variables:

- `DOCKER_REGISTRY`
- `CI_REGISTRY_PROJECT`
- `CI_REGISTRY_USER`
- `CI_REGISTRY_PASSWORD`
- `KUBE_NAMESPACE`
- `KUBECONFIG_FILE`
- `KUBE_DEPLOYMENT`
- `KUBE_CONTAINER`
- `KUBE_ROLLOUT_TIMEOUT` optional, defaults to `60s`
- `MAVEN_SETTINGS_XML`
- `WECHAT_WEBHOOK` when publish/deploy/image notification is requested

Frontend-only pipelines usually do not need `MAVEN_SETTINGS_XML`. Node/Vue jobs default npm and pnpm installs to `https://registry.npmmirror.com`; set `NPM_CONFIG_REGISTRY` and add pnpm `--registry=https://registry.npmmirror.com` unless project-specific registry settings must be preserved. Add or preserve `NPM_TOKEN`, scoped registry variables, or project-specific npm authentication only when the project needs private npm packages or already has `.npmrc` settings.

Never hard-code secrets.

## Quality Checklist

Before finishing, verify:

- `.gitlab-ci.yml` is valid YAML with correct indentation.
- Stage names match all job `stage` values.
- `needs` references use exact job names.
- Artifacts or dotenv files are produced before downstream jobs consume them.
- `artifacts.expire_in` is omitted unless the user explicitly requested a concrete retention period.
- Required variables fail fast with shell parameter checks when used in scripts.
- Node jobs use the package manager and Node version indicated by project files.
- Node/Vue npm jobs cache `.npm/` package downloads, not `node_modules/`, unless the user explicitly asks to cache installed dependencies.
- Node/Vue npm and pnpm install jobs use `https://registry.npmmirror.com` by default, unless project-specific private registry settings must be preserved.
- Node/Vue package jobs set `HUSKY: "0"` to disable Husky hooks during CI dependency installation.
- Frontend image jobs receive the built static artifact and use a Kaniko context that includes every path referenced by the Dockerfile.
- Optional notification jobs reference `WECHAT_WEBHOOK`, include `mentioned_list` with `GITLAB_USER_LOGIN`, and never hard-code webhook URLs or keys.
- `rules.changes` paths match the actual project layout.
- Branch and deploy behavior match the user's stated environment policy.
- Secrets are referenced as CI variables, never hard-coded.

## Output Style

When generating CI:

- Edit or create `.gitlab-ci.yml` directly unless the user asks only for an example.
- Keep the pipeline minimal for the detected project.
- Briefly list assumptions and GitLab variables to configure.
- Mention validation performed or that GitLab CI lint should be used.
- Do not commit changes unless the user explicitly asks.

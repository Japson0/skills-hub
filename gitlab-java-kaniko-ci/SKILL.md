---
name: gitlab-java-kaniko-ci
description: Generate a .gitlab-ci.yml for an existing project by inspecting its language, build tool, Dockerfile, deployment style, and branch policy. Use when the user says they have a project and want to generate GitLab CI, gitlab-ci.yml, or gitlab-cli.yml; supports general project analysis and includes this repository's Java Maven + Kaniko + kubectl pipeline as a reference template when applicable.
license: MIT
compatibility: Requires GitLab CI. Optional templates cover Java Maven, Kaniko image builds, and Kubernetes deployment by kubectl.
metadata:
  author: newland
  version: "1.6"
---

Generate a `.gitlab-ci.yml` for a project by first understanding the project, then choosing the smallest correct pipeline. For Java Maven services in this environment, the normal delivery flow is package JAR, build/push image, then update the Kubernetes Deployment image.

Treat `gitlab-cli.yml` in user prompts as likely meaning GitLab CI config. The actual file name should normally be `.gitlab-ci.yml` unless the user explicitly says otherwise.

This skill is general-purpose. Do not blindly copy this repository's pipeline for non-Java projects. For Java Maven services that have a Dockerfile and are intended to deploy, prefer the Java Maven + Kaniko + kubectl flow because it matches the normal delivery path in this environment.

## Workflow

1. Inspect the target project.
2. Identify language, package manager/build tool, Java/JDK version when applicable, test command, Docker/image strategy, deployment target, and branch policy.
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
- Node.js: `package.json`, lockfiles, scripts.
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

If the user asks for CI only, do not add deployment. If the project has no Dockerfile and the user did not ask for images, do not add image build jobs. For non-Java projects, keep using the smallest stage set that matches the request and project evidence.

## Branch And Rule Policy

Prefer `workflow.rules` when the user wants pipelines only on specific branches.

Example based on this repository:

```yaml
workflow:
  rules:
    - if: '$CI_COMMIT_BRANCH =~ /^(develop|release-.*)$/'
    - when: never
```

For job-level rules, use `rules.changes` to avoid running unrelated service jobs in monorepos.

If following this repository's branch policy:

- `develop`: package, image, and deploy can run when relevant files change.
- `release-*`: package and image can run, but deploy jobs are skipped by default.

Deploy skip rule:

```yaml
rules:
  - if: '$CI_COMMIT_BRANCH =~ /^release-.*$/'
    when: never
  - changes:
      - <service-path>/**/*
```

Ask before applying this policy to another project unless the user says to reuse this repository's behavior.

## Build Tool Templates

Use these as starting points and adapt to the target project's actual commands.

### Java Maven

Use Maven Wrapper when present:

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
    expire_in: 7 days
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
    expire_in: 7 days
```

If using this repository's Dockerfile pattern, copy the selected JAR into `build/temp/` instead of publishing directly from `target/`.

### Node.js

Infer commands from `package.json` scripts. Typical job:

```yaml
image: node:20

cache:
  key:
    files:
      - package-lock.json
  paths:
    - node_modules/

test:
  stage: test
  script:
    - npm ci
    - npm test
```

Use `npm run build` only if a `build` script exists.

### Python

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

### Go

```yaml
image: golang:1.22

test:
  stage: test
  script:
    - go test ./...
```

## Image Build Options

Choose the image strategy based on project constraints.

### Kaniko

Use Kaniko when Docker-in-Docker is unavailable or not desired. Use internal Kaniko executor image `image.server:8082/library/kaniko-project/executor:v1.23.2-debug` for image build jobs.

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
      IMAGE_TAG="${CI_COMMIT_REF_NAME}_$(date +%F-%H-%M-%S)"
      IMAGE_URL="$DOCKER_REGISTRY/$CI_REGISTRY_PROJECT/$CI_PROJECT_NAME:$IMAGE_TAG"
      /kaniko/executor --context "$CI_PROJECT_DIR" --dockerfile "$CI_PROJECT_DIR/Dockerfile" --destination "$IMAGE_URL"
      echo "IMAGE_URL=$IMAGE_URL" > build.env
  artifacts:
    reports:
      dotenv: build.env
    expire_in: 7 days
```

Use insecure flags only when the target environment requires them.

### Docker-In-Docker

Only use Docker-in-Docker when the project already uses it or the user requests it. It requires runner support and is often less appropriate for locked-down environments.

## Deploy Options

For Java Maven services, deployment normally means updating the Kubernetes Deployment image after the image job produces `IMAGE_URL`. Generate this deploy job by default when using the Java Maven + Kaniko flow unless the user explicitly says not to deploy.

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
      export KUBECONFIG="$KUBECONFIG_FILE"
    - kubectl -n "$KUBE_NAMESPACE" set image "deployment/$KUBE_DEPLOYMENT" "$KUBE_CONTAINER=$IMAGE_URL"
    - kubectl -n "$KUBE_NAMESPACE" rollout status "deployment/$KUBE_DEPLOYMENT"
```

### Helm, Kustomize, GitOps

If manifests indicate Helm, Kustomize, Argo CD, or another GitOps flow, do not replace it with `kubectl set image`. Ask whether to generate CI for the existing deployment tool.

## Reference Template From This Repository

Use this when the target is a Java Maven service in this environment, or when the user wants the same pattern as this repository:

- Branch workflow: run pipelines on `develop` and `release-*`.
- Stages: `package`, `image`, `deploy`.
- Normal flow: package the JAR, build/push the Docker image, then update the K8S Deployment image.
- Maven package: `./mvnw $MAVEN_CLI_OPTS -s "$MAVEN_SETTINGS_XML" -pl $MODULE_NAME -am clean package -DskipTests` for multi-module services.
- Artifact handoff: copy the service JAR to `build/temp/*.jar`.
- Image build: Kaniko with image `image.server:8082/library/kaniko-project/executor:v1.23.2-debug`, `build/Dockerfile`, and `--build-arg MODULE_NAME="$MODULE_NAME"`.
- Image tag: `${CI_COMMIT_REF_NAME}_$(date +%F-%H-%M-%S)`.
- Image URL dotenv artifact: write `IMAGE_URL=...` to `build.env`.
- Deploy: `kubectl set image` and `kubectl rollout status`.
- Deploy image: `image.server:8082/library/bitnami/kubectl:1.28`.
- Release policy: deploy jobs skip `release-*` by default.

For each deployable module, generate:

- `package:<short-name>`
- `image:<short-name>` needing `package:<short-name>` artifacts
- `deploy:<short-name>` needing `image:<short-name>` dotenv artifacts

Include `rules.changes` for root build files, wrapper files, Dockerfile, and the service path.

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
- `MAVEN_SETTINGS_XML`

Never hard-code secrets.

## Quality Checklist

Before finishing, verify:

- `.gitlab-ci.yml` is valid YAML with correct indentation.
- Stage names match all job `stage` values.
- `needs` references use exact job names.
- Artifacts or dotenv files are produced before downstream jobs consume them.
- Required variables fail fast with shell parameter checks when used in scripts.
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

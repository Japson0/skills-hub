---
name: gitlab-java-kaniko-ci
description: Generate or update GitLab CI pipelines specifically for Java Maven services, including single-module and multi-module Java projects that build JAR artifacts, publish Docker images with Kaniko, and deploy to Kubernetes with kubectl. Use this skill whenever the user asks to create .gitlab-ci.yml for a Java/Maven project, adapt this project's GitLab pipeline to another Java project, add Java service module CI jobs, or troubleshoot a similar Maven + Kaniko + Kubernetes GitLab CI setup.
license: MIT
compatibility: Requires GitLab CI. Optimized for Maven wrapper projects, Kaniko image builds, and Kubernetes deployment by kubectl.
metadata:
  author: newland
  version: "1.0"
---

Create a reusable GitLab CI configuration for Java projects, modeled after this repository's `.gitlab-ci.yml`.

The reference pipeline is designed for Java services built by Maven. It supports both single-module Java services and Maven multi-module Java services where each deployable module is packaged as a JAR, copied into `build/temp/`, built into a Docker image by Kaniko using `build/Dockerfile`, then deployed by updating a Kubernetes Deployment container image.

## When To Use

Use this skill when the target project has most of these traits:

- GitLab CI is the CI/CD platform.
- Java services are built with Maven or Maven Wrapper and produce JAR artifacts.
- The project may contain multiple deployable Maven modules.
- Docker images should be built inside CI without Docker-in-Docker, using Kaniko.
- Deployment is done by `kubectl set image` and `kubectl rollout status`.
- CI should run only on selected branches and only when relevant files change.

If the project is not Java, or if it is Gradle, Node, Go, Python, Helm-only, Docker-in-Docker, or not deployed to Kubernetes, adapt the pattern rather than copying it directly. Ask one short clarification if the language, deployment target, or image registry is unclear.

## First Inspect The Target Project

Before generating or editing `.gitlab-ci.yml`, inspect the repository instead of assuming names.

Check:

- `pom.xml` and child module directories.
- Whether `mvnw` and `.mvn/wrapper/` exist.
- Whether `build/Dockerfile` exists and how it accepts the module or artifact path.
- Existing `.gitlab-ci.yml` or `.gitlab-ci.yaml` if present.
- Which modules are deployable services versus shared libraries.
- Existing Kubernetes Deployment/container naming conventions, if manifests are present.

If module discovery is ambiguous, summarize the candidate modules and ask which ones should get deploy jobs.

## Pipeline Shape

Generate a pipeline with these stages, in this order:

```yaml
stages:
  - package
  - image
  - deploy
```

Use top-level `workflow.rules` to limit pipeline creation. The reference project runs on `develop` and `release-*` branches:

```yaml
workflow:
  rules:
    - if: '$CI_COMMIT_BRANCH =~ /^(develop|release-.*)$/'
    - when: never
```

Adjust branch patterns only when the target project has clearly different branch names, such as `main`, `master`, `test`, or environment branches.

## Base Variables

Prefer variables that keep Maven, registry, and Kaniko behavior centralized:

```yaml
variables:
  MAVEN_USER_HOME: "$CI_PROJECT_DIR/.m2"
  MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository -Dfile.encoding=UTF-8"
  MAVEN_CLI_OPTS: "--batch-mode --errors --fail-at-end --show-version -s $MAVEN_SETTINGS_XML"
  KANIKO_EXTRA_ARGS: "--insecure --insecure-pull"
```

Keep `KANIKO_EXTRA_ARGS` only when the registry requires insecure access. For standard TLS registries, remove it or leave it empty.

Expected GitLab CI/CD variables:

- `MAVEN_SETTINGS_XML`: path to the Maven settings file available in CI.
- `DOCKER_REGISTRY`: registry host, for example `registry.example.com`.
- `CI_REGISTRY_PROJECT`: namespace/project path inside the registry.
- `CI_REGISTRY_USER`: registry username.
- `CI_REGISTRY_PASSWORD`: registry password or token.
- `KUBE_NAMESPACE`: target Kubernetes namespace.
- `KUBECONFIG_FILE`: GitLab file variable containing kubeconfig, or a path to one.

Per-service variables:

- `MODULE_NAME`: Maven module directory and default image/container name.
- `KUBE_DEPLOYMENT`: Kubernetes Deployment name.
- `KUBE_CONTAINER`: container name inside the Deployment.

## Maven Package Template

Use Maven wrapper when present. Package only the selected module and its dependencies with `-pl $MODULE_NAME -am`.

Template:

```yaml
.package_template:
  stage: package
  script:
    - ./mvnw $MAVEN_CLI_OPTS -pl $MODULE_NAME -am clean package -DskipTests
    - mkdir -p build/temp
    - |
      JAR_FILE=""
      for file in "$MODULE_NAME"/target/"$MODULE_NAME"-*.jar; do
        case "$file" in
          *-sources.jar|*/original-*) continue ;;
        esac
        JAR_FILE="$file"
        break
      done
      test -n "$JAR_FILE"
      cp "$JAR_FILE" build/temp/
  artifacts:
    name: "$MODULE_NAME-$CI_COMMIT_SHORT_SHA"
    paths:
      - build/temp/*.jar
    exclude:
      - "**/target/*-sources.jar"
      - "**/target/original-*.jar"
    expire_in: 7 days
```

If the target project does not use Maven wrapper, replace `./mvnw` with `mvn` and remove `chmod +x ./mvnw` from `before_script`.

If artifact naming does not match `$MODULE_NAME-*.jar`, update the JAR discovery logic instead of assuming the reference naming.

## Single Module Projects

For a single deployable Maven project, keep the same three-stage pipeline but simplify the Maven build and job variables. Do not force `-pl $MODULE_NAME -am` when the repository root itself is the service.

Use this package template for a root-level Spring Boot or Java service:

```yaml
.package_template:
  stage: package
  script:
    - ./mvnw $MAVEN_CLI_OPTS clean package -DskipTests
    - mkdir -p build/temp
    - |
      JAR_FILE=""
      for file in target/*.jar; do
        case "$file" in
          *-sources.jar|*/original-*) continue ;;
        esac
        JAR_FILE="$file"
        break
      done
      test -n "$JAR_FILE"
      cp "$JAR_FILE" build/temp/
  artifacts:
    name: "$CI_PROJECT_NAME-$CI_COMMIT_SHORT_SHA"
    paths:
      - build/temp/*.jar
    exclude:
      - "**/target/*-sources.jar"
      - "**/target/original-*.jar"
    expire_in: 7 days
```

For the image job, choose a stable image name. Prefer `SERVICE_NAME` for single-module projects because there is no module directory to reuse:

```yaml
variables:
  SERVICE_NAME: <service-name>
```

Then build the image as:

```yaml
IMAGE_URL="$DOCKER_REGISTRY/$CI_REGISTRY_PROJECT/$SERVICE_NAME:$IMAGE_TAG"
/kaniko/executor --context "$CI_PROJECT_DIR" --dockerfile "$CI_PROJECT_DIR/build/Dockerfile" --destination "$IMAGE_URL" $KANIKO_EXTRA_ARGS
```

Only pass `--build-arg MODULE_NAME=...` if the target Dockerfile actually expects it. For a single module, the Dockerfile often only needs to copy `build/temp/*.jar`.

Single-module jobs usually look like this:

```yaml
package:
  extends: .package_template
  rules:
    - changes:
        - pom.xml
        - mvnw
        - .mvn/wrapper/**/*
        - build/Dockerfile
        - src/**/*

image:
  extends: .image_template
  needs:
    - job: package
      artifacts: true
  rules:
    - changes:
        - pom.xml
        - mvnw
        - .mvn/wrapper/**/*
        - build/Dockerfile
        - src/**/*

deploy:
  extends: .deploy_template
  needs:
    - job: image
      artifacts: true
  variables:
    KUBE_DEPLOYMENT: <deployment-name>
    KUBE_CONTAINER: <container-name>
  rules:
    - changes:
        - pom.xml
        - mvnw
        - .mvn/wrapper/**/*
        - build/Dockerfile
        - src/**/*
```

If the single-module project still stores code under a nonstandard directory, replace `src/**/*` with the actual source paths.

## Kaniko Image Template

Use Kaniko for image builds and pass the module name into the shared Dockerfile.

Template:

```yaml
.image_template:
  stage: image
  image:
    name: image.server:8082/library/kaniko-project/executor:v1.23.2-debug
    entrypoint: [""]
  before_script: []
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
      IMAGE_URL="$DOCKER_REGISTRY/$CI_REGISTRY_PROJECT/$MODULE_NAME:$IMAGE_TAG"
      echo "Pushing image: $IMAGE_URL"
      /kaniko/executor --context "$CI_PROJECT_DIR" --dockerfile "$CI_PROJECT_DIR/build/Dockerfile" --build-arg MODULE_NAME="$MODULE_NAME" --destination "$IMAGE_URL" $KANIKO_EXTRA_ARGS
      echo "IMAGE_URL=$IMAGE_URL" > build.env
  artifacts:
    reports:
      dotenv: build.env
    expire_in: 7 days
```

Adapt `image.name` to the target organization's internal mirror. Use the public Kaniko image only if allowed by the project's network policy.

Keep the `dotenv` artifact because deploy jobs need the exact `IMAGE_URL` produced by the image job.

## Kubernetes Deploy Template

Deploy by updating the Deployment container image and waiting for rollout.

Template:

```yaml
.deploy_template:
  stage: deploy
  environment:
    name: $CI_COMMIT_REF_SLUG
  image:
    name: image.server:8082/library/bitnami/kubectl:1.28
    entrypoint: [""]
  before_script: []
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

If the target project uses Helm, Kustomize, Argo CD, or GitOps, do not force this template. Ask whether to keep direct `kubectl set image` or generate a deployment step for the actual tool.

## Service Job Pattern

For each deployable module, create three jobs with consistent naming:

```yaml
package:<short-name>:
  extends: .package_template
  variables:
    MODULE_NAME: <module-directory>
  rules:
    - changes:
        - pom.xml
        - mvnw
        - .mvn/wrapper/**/*
        - build/Dockerfile
        - <module-directory>/**/*

image:<short-name>:
  extends: .image_template
  needs:
    - job: package:<short-name>
      artifacts: true
  variables:
    MODULE_NAME: <module-directory>
  rules:
    - changes:
        - pom.xml
        - mvnw
        - .mvn/wrapper/**/*
        - build/Dockerfile
        - <module-directory>/**/*

deploy:<short-name>:
  extends: .deploy_template
  needs:
    - job: image:<short-name>
      artifacts: true
  variables:
    KUBE_DEPLOYMENT: <deployment-name>
    KUBE_CONTAINER: <container-name>
  rules:
    - changes:
        - pom.xml
        - mvnw
        - .mvn/wrapper/**/*
        - build/Dockerfile
        - <module-directory>/**/*
```

Derive `<short-name>` from the service name, not necessarily the full module directory. Example: `nledu-cloud-agi-third-proxy` can become `third-proxy`.

If changing a shared API/library module should rebuild dependent services, include that shared module path in each affected service's `rules.changes`.

## Quality Checklist

Before finishing, verify the generated YAML for these properties:

- `.gitlab-ci.yml` is valid YAML with correct indentation.
- Stage names match all job `stage` values.
- `needs` references use exact job names.
- `image` jobs consume package artifacts.
- `deploy` jobs consume the dotenv `IMAGE_URL` from image jobs.
- Required variables fail fast with shell parameter checks.
- `rules.changes` includes root build files, wrapper files, Dockerfile, and the module path.
- Shared library changes are handled if required by the project.
- Secrets are referenced as CI variables, never hard-coded.
- Internal image mirrors and registry names are adapted to the target environment.

If the repository has a YAML validator available, run it. If not, at least inspect the generated file and mention that CI validation should be done in GitLab.

## Output Style

When creating a pipeline for another project:

- Make the smallest complete `.gitlab-ci.yml` that matches the project's modules and deployment approach.
- Briefly list the CI/CD variables the user must configure in GitLab.
- Mention any assumptions, such as deployment/container names or branch patterns.
- Do not commit changes unless the user explicitly asks.

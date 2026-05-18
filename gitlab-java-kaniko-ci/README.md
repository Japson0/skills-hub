# GitLab CI Generator Skill

这是一个用于生成 `.gitlab-ci.yml` 的通用 opencode skill。

它的目标不是固定套用某一种 CI 模板，而是先分析目标项目结构，再根据项目的语言、构建工具、Dockerfile、部署方式和分支策略，生成可用的 GitLab CI 配置。对于当前环境的 Java Maven 服务，默认正常流程是构建 JAR 包、构建镜像、然后更新 K8S 中的镜像信息。


## 适用场景

当你有一个项目，并希望快速生成 GitLab CI 配置时，可以使用这个 skill。

典型请求：

```text
我有个项目，帮我根据项目结构生成 .gitlab-ci.yml
```

```text
帮我给这个 Java Maven 项目生成 GitLab CI，要求打包、构建镜像、部署到 Kubernetes
```

```text
这个 Node 项目有 Dockerfile，只需要测试和构建镜像，不需要部署
```

```text
参考当前仓库的 GitLab CI 模板，给另一个 Maven 多模块项目生成 CI
```

如果用户误写成 `gitlab-cli.yml`，skill 会按 GitLab CI 配置理解，默认生成 `.gitlab-ci.yml`。

## 工作流程

skill 会按以下步骤执行：

1. 检查目标项目结构。
2. 判断项目语言和构建工具。
3. 判断是否存在 Dockerfile。
4. 如果是 Java 项目，判断 JDK 版本。
5. 判断是否需要测试、打包、构建镜像、部署；Java Maven 服务默认按构建 JAR、构建镜像、更新 K8S 镜像信息处理，除非用户明确不要部署。
6. 根据项目实际情况生成 `.gitlab-ci.yml`。
7. 列出需要在 GitLab CI/CD Variables 中配置的变量。
8. 尽量校验 YAML 结构和 job 依赖关系。

## 支持识别的项目类型

当前 skill 会根据这些文件识别项目：

- Java Maven：`pom.xml`、`mvnw`、`.mvn/wrapper/`
- Java/JDK 版本：`pom.xml` 中的 `java.version`、`maven.compiler.source`、`maven.compiler.target`、`maven.compiler.release`，以及 `.java-version`、`Dockerfile`、README/构建文档
- Java Gradle：`build.gradle`、`build.gradle.kts`、`gradlew`
- Node.js：`package.json`、`package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`
- Python：`pyproject.toml`、`requirements.txt`、`poetry.lock`、`Pipfile`
- Go：`go.mod`
- Docker：`Dockerfile`、`build/Dockerfile`
- Kubernetes：`k8s/`、`deploy/`、`helm/`、`Chart.yaml`、`kustomization.yaml`

## 内置参考模板

这个 skill 内置了当前仓库的 Java Maven + Kaniko + kubectl 模板。

该模板适用于：

- Java Maven 单模块项目
- Java Maven 多模块项目
- 使用 Maven Wrapper 打包 JAR
- Maven 构建命令必须带 `-s $MAVEN_SETTINGS_XML`，因为私服、认证等配置依赖该 settings 文件
- JDK 8 Maven job 使用 `image.server:8082/library/maven:3.8.6-openjdk-8`
- JDK 17 Maven job 使用 `image.server:8082/library/maven:3.9.12-eclipse-temurin-17`
- 使用 Kaniko 构建 Docker 镜像
- 使用 `kubectl set image` 发布到 Kubernetes，kubectl job 镜像使用 `image.server:8082/library/bitnami/kubectl:1.28`

当前仓库模板的核心流程：

```text
package -> image -> deploy
```

对应实际动作：

```text
构建 JAR 包 -> 构建并推送 Docker 镜像 -> kubectl set image 更新 K8S Deployment 镜像
```

多模块项目会为每个服务生成：

```text
package:<service>
image:<service>
deploy:<service>
```

如果复用当前仓库分支策略：

- `develop` 分支允许打包、构建镜像、部署
- `release-*` 分支只打包和构建镜像，默认跳过部署

## 生成原则

- 不盲目套模板。
- 不给不需要部署的项目添加 deploy job。
- Java Maven 服务的正常流程包含 deploy job，用于更新 K8S 中的镜像信息；只有用户明确说 CI-only、不部署或项目证据不支持部署时才省略。
- 不给没有 Dockerfile 的项目强行添加 image job。
- 单模块 Java 项目不使用多模块的 `-pl $MODULE_NAME -am`。
- Java Maven 项目先检测 JDK 版本，再选择对应内网 Maven 镜像；如果无法判断 JDK 8 或 JDK 17，应先询问确认。
- Java Maven 构建必须校验并使用 `MAVEN_SETTINGS_XML`，所有 Maven 命令都要带 `-s $MAVEN_SETTINGS_XML`。
- kubectl deploy job 使用内网镜像 `image.server:8082/library/bitnami/kubectl:1.28`。
- 多模块项目使用 `rules.changes` 限制服务 job 的触发范围。
- secrets 只引用 GitLab CI/CD Variables，不写入配置文件。
- 尽量生成最小、可维护的 `.gitlab-ci.yml`。

## 常见变量

根据生成的 pipeline，可能需要配置以下 GitLab CI/CD Variables：


- `KUBE_NAMESPACE`
- `MAVEN_SETTINGS_XML`


实际变量以生成后的 `.gitlab-ci.yml` 为准。

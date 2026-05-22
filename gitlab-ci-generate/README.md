# GitLab CI Generator Skill

这是一个用于生成 `.gitlab-ci.yml` 的通用 opencode skill。

它的目标不是固定套用某一种 CI 模板，而是先分析目标项目结构，再根据项目的语言、构建工具、Dockerfile、部署方式和分支策略，生成可用的 GitLab CI 配置。对于当前环境的 Java Maven 服务，默认正常流程是构建 JAR 包、构建镜像、然后更新 K8S 中的镜像信息。对于 Vue/Node.js 静态前端，默认正常流程是安装依赖、构建 `dist/`、构建 nginx 静态资源镜像，然后在 `develop` 分支更新 K8S 镜像；`release-*` 分支只构建镜像不部署。


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
帮我给这个 Vue 前端项目生成 GitLab CI，build 后用 Kaniko 构建 nginx 镜像，develop 部署，release 只构建镜像
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
4. 如果是 Java 项目，判断 JDK 版本；如果是 Node/Vue 项目，判断 Node 版本和包管理器。
5. 判断是否需要打包、构建镜像、部署；Java Maven 服务默认按构建 JAR、构建镜像、更新 K8S 镜像信息处理，Vue/Node.js 静态前端默认按构建静态文件、构建 nginx 镜像、`develop` 部署处理，除非用户明确不要部署。
6. 根据项目实际情况生成 `.gitlab-ci.yml`。
7. 列出需要在 GitLab CI/CD Variables 中配置的变量。
8. 尽量校验 YAML 结构和 job 依赖关系。

## 支持识别的项目类型

当前 skill 会根据这些文件识别项目：

- Java Maven：`pom.xml`、`mvnw`、`.mvn/wrapper/`
- Java/JDK 版本：`pom.xml` 中的 `java.version`、`maven.compiler.source`、`maven.compiler.target`、`maven.compiler.release`，以及 `.java-version`、`Dockerfile`、README/构建文档
- Java Gradle：`build.gradle`、`build.gradle.kts`、`gradlew`
- Node.js：`package.json`、`package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`、`engines.node`、`volta.node`、`.nvmrc`、`.node-version`
- Vue 前端：`vue.config.js`、`vite.config.*`、`nuxt.config.*`，以及 `vue`、`@vue/cli-service`、`vite`、`nuxt` 等依赖
- Python：`pyproject.toml`、`requirements.txt`、`poetry.lock`、`Pipfile`
- Go：`go.mod`
- Docker：`Dockerfile`、`build/Dockerfile`
- Kubernetes：`k8s/`、`deploy/`、`helm/`、`Chart.yaml`、`kustomization.yaml`

## 内置参考模板

这个 skill 内置了当前环境常用的 Java Maven + Kaniko + kubectl 模板，以及 Vue/Node.js 静态前端 + Kaniko + kubectl 模板。语言/构建工具的详细模板拆分在 `references/build-tools.md`，主 `SKILL.md` 只保留检测、决策、分支、部署、通知等通用规则，方便后续继续增加其他语言。

### Java Maven 服务

Java Maven 模板适用于：

- Java Maven 单模块项目
- Java Maven 多模块项目
- 使用 Maven Wrapper 打包 JAR
- Maven 构建命令必须带 `-s $MAVEN_SETTINGS_XML`，因为私服、认证等配置依赖该 settings 文件
- JDK 8 Maven job 使用 `image.server:8082/library/maven:3.8.6-openjdk-8`
- JDK 17 Maven job 使用 `image.server:8082/library/maven:3.9.12-eclipse-temurin-17`
- 使用 Kaniko 构建 Docker 镜像，Kaniko job 镜像使用 `image.server:8082/library/kaniko-project/executor:v1.23.2-debug`，并带 `--insecure-pull --insecure` 允许从 HTTP 仓库拉取基础镜像并推送镜像
- 使用 `kubectl set image` 发布到 Kubernetes，kubectl job 镜像使用 `image.server:8082/library/bitnami/kubectl:1.28`，并给 `kubectl rollout status` 设置默认 `60s` 超时，避免容器启动失败时 deploy 阶段一直等待

Java Maven 模板的核心流程：

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

- 仅 `develop` 和 `release-*` 分支启动流水线
- `develop` 分支允许打包、构建镜像、部署
- `release-*` 分支只打包和构建镜像，默认跳过部署

### Vue/Node.js 静态前端

Vue/Node.js 前端模板适用于：

- Vue CLI、Vite、Nuxt 或类似会构建静态资源的前端项目
- `package.json` 中存在 `build` 脚本，例如 `npm run build`
- 构建产物通常是 `dist/`
- Dockerfile 将 `dist/` 和 nginx 配置复制进 nginx 镜像，例如 `lib/Dockerfile` + `lib/nginx.conf`
- 使用 Kaniko 构建镜像
- 使用 `kubectl set image` 更新 Kubernetes Deployment 镜像
- `kubectl rollout status` 默认等待 `60s`，可通过 `KUBE_ROLLOUT_TIMEOUT` 覆盖，避免容器启动失败时 deploy job 长时间卡住

Vue/Node.js 前端模板的核心流程：

```text
package:web -> image:web -> deploy:web
```

对应实际动作：

```text
安装 npm 依赖并构建 dist -> 构建并推送 nginx 镜像 -> develop 分支更新 K8S Deployment 镜像
```

分支策略与 Java 保持一致：

- 仅 `develop` 和 `release-*` 分支启动流水线
- `develop` 分支允许构建静态资源、构建镜像、部署
- `release-*` 分支只构建静态资源和镜像，默认跳过部署
- 其他分支跳过整个流水线

Node 构建镜像选择规则：

- 优先使用项目声明的 Node 版本，例如 `package.json` 中的 `volta.node`、`engines.node`、`.nvmrc`、`.node-version`
- 可以使用内网 Node 镜像，例如 `image.server:8082/library/node:14.18.0`；当项目证据显示需要较高 Node 版本，例如 `engines.node`、`.nvmrc`、`.node-version`、Volta、Vite/Nuxt 文档或依赖要求为 Node 20+ 时，默认使用 `image.server:8082/library/node:22.19.0`
- Alpine 镜像可以用于构建，但如果遇到原生依赖编译问题，应切换到非 Alpine Node 镜像，或使用预装 `python3`、`make`、`g++` 的内网 Node 镜像

npm 缓存策略：

- 默认缓存 npm 包下载缓存 `.npm/`
- 默认不缓存 `node_modules/`
- 默认 npm/pnpm 安装都使用 `https://registry.npmmirror.com` 淘宝镜像源；pnpm install 命令显式追加 `--registry=https://registry.npmmirror.com`
- Node/Vue package job 默认设置 `HUSKY=0`，避免 Husky `prepare` 或 Git hooks 安装在 CI 里导致依赖安装失败
- 有 `package-lock.json` 时使用 `npm ci --cache .npm --prefer-offline`
- 没有 `package-lock.json` 时使用 `npm install --cache .npm --prefer-offline`
- 只有用户明确要求时，才考虑缓存 `node_modules/`
- 如果项目已有私有 npm 仓库、scope registry 或 `.npmrc` 认证配置，应保留项目配置，不强行覆盖为淘宝源

## 生成原则

- 不盲目套模板。
- 不给不需要部署的项目添加 deploy job。
- Java Maven 服务的正常流程包含 deploy job，用于更新 K8S 中的镜像信息；只有用户明确说 CI-only、不部署或项目证据不支持部署时才省略。
- Vue/Node.js 静态前端的正常流程包含 deploy job，但 deploy 只在 `develop` 分支执行；`release-*` 分支只构建镜像。
- 不给没有 Dockerfile 的项目强行添加 image job。
- 单模块 Java 项目不使用多模块的 `-pl $MODULE_NAME -am`。
- Java Maven 项目先检测 JDK 版本，再选择对应内网 Maven 镜像；如果无法判断 JDK 8 或 JDK 17，应先询问确认。
- Java Maven 构建必须校验并使用 `MAVEN_SETTINGS_XML`，所有 Maven 命令都要带 `-s $MAVEN_SETTINGS_XML`。
- Node/Vue 项目先检测 Node 版本和包管理器，再选择对应 Node 构建镜像和安装命令。
- Node/Vue 默认不生成测试或 lint job；只有用户明确要求或项目已有明确 CI 规则时才生成。
- Node/Vue 默认缓存 `.npm/` 包下载缓存，不缓存 `node_modules/`。
- Node/Vue 默认使用 `https://registry.npmmirror.com` 作为 npm/pnpm 安装源；如果项目使用私有 npm 仓库或 `.npmrc`，优先保留项目配置。
- Node/Vue package job 默认设置 `HUSKY=0`，CI 中不安装或执行 Husky hooks。
- 默认不设置 `artifacts.expire_in`，所有产物过期时间使用 GitLab 系统/项目默认设置；只有用户明确要求具体保留时间时才生成 `artifacts.expire_in`。
- Kaniko image job 使用内网镜像 `image.server:8082/library/kaniko-project/executor:v1.23.2-debug`。
- Kaniko executor 命令带 `--insecure-pull --insecure`，允许构建镜像时从 HTTP registry 拉取基础镜像并推送到 HTTP registry。
- Vue/Node.js 前端如果 Dockerfile 同时引用 `dist/` 和 `lib/nginx.conf`，Kaniko context 应使用 `$CI_PROJECT_DIR`，不能只指向 `lib/`。
- kubectl deploy job 使用内网镜像 `image.server:8082/library/bitnami/kubectl:1.28`。
- kubectl deploy job 必须给 `rollout status` 设置显式超时，默认 `60s`，可通过 `KUBE_ROLLOUT_TIMEOUT` 覆盖。
- 通知是可选能力，只有用户明确要求发布/部署/镜像通知时才生成通知 job。
- `develop` 分支发布成功后发送发布成功通知；`develop` 分支 package、image 或 deploy 任一失败都会发送发布失败通知；`release-*` 分支默认跳过部署，但镜像构建成功或失败都会发送镜像构建通知。
- 企业微信发布通知使用 GitLab CI/CD Variable `WECHAT_WEBHOOK` 保存 webhook URL，不在 `.gitlab-ci.yml` 中硬编码 webhook 地址或 key；text 消息 payload 默认带 `"mentioned_list":["${GITLAB_USER_LOGIN}"]`，通知触发流水线的用户。
- 通知 job 默认独立放在 `notify` stage，使用 `curl` 发送 HTTP 请求，不依赖 Python 或第三方 `requests` 包。
- 默认 workflow 只允许 `develop` 和 `release-*` 分支启动流水线，其他分支都跳过。
- 多模块项目使用 `rules.changes` 限制服务 job 的触发范围。
- secrets 只引用 GitLab CI/CD Variables，不写入配置文件。
- 尽量生成最小、可维护的 `.gitlab-ci.yml`。

## 可选通知

当用户要求增加发布/部署/镜像通知时，skill 会在 pipeline 中额外生成 `notify` 阶段和通知 job。通知内容类似：

```text
开发环境发布通知
<项目或模块名>:<镜像 tag>发布成功
```

失败时会发送：

```text
开发环境发布通知
<项目或模块名>:<分支>发布失败
```

在 `develop` 分支，package、image 或 deploy 任一阶段失败都会触发发布失败通知。发布失败通知优先使用模块名，没有模块名时使用项目名，并使用分支名，例如 `tpsp-monorepo-client:develop发布失败`，不使用镜像 tag 或 `IMAGE_URL`。

发布成功和镜像构建通知展示镜像 tag，不展示完整 `IMAGE_URL`。例如应生成 `tpsp-monorepo-client-admin:release-1.8.0-mjsz_2026-05-21-14-11-55`，而不是 `nledu-cloud-operatation-analysis:image.server:8082/nledu-cloud/nledu-cloud-operatation-analysis:release-1.0.0_2026-05-21-06-10-42`。生成的 image job 会把 `IMAGE_URL` 和 `IMAGE_TAG` 都写入 `build.env`：deploy 使用 `IMAGE_URL`，通知展示 `IMAGE_TAG`。

对于默认只构建镜像、不部署的 `release-*` 分支，镜像构建成功后会发送：

```text
镜像构建通知
<项目或模块名>:<镜像 tag>构建成功
```

如果 `release-*` 分支 package 或 image 阶段失败，会发送：

```text
镜像构建通知
<项目或模块名>:<镜像 tag 或分支>构建失败
```

企业微信 webhook URL 通过 `WECHAT_WEBHOOK` 变量读取，例如在 GitLab 项目的 CI/CD Variables 中配置 `WECHAT_WEBHOOK`。text 消息 payload 默认带 `"mentioned_list":["${GITLAB_USER_LOGIN}"]`，用于通知触发流水线的用户。默认 curl 镜像使用 `image.server:8082/library/curlimages/curl:8.9.1`；如果运行环境不能拉取该镜像，需要替换为其他可用的内网 curl 镜像，或其他包含 `curl` 命令的镜像。

## 常见变量

根据生成的 pipeline，可能需要配置以下 GitLab CI/CD Variables：


- `KUBE_NAMESPACE`
- `KUBECONFIG_FILE`
- `KUBE_DEPLOYMENT`
- `KUBE_CONTAINER`
- `KUBE_ROLLOUT_TIMEOUT`：可选，默认 `60s`
- `MAVEN_SETTINGS_XML`
- `DOCKER_REGISTRY`
- `CI_REGISTRY_PROJECT`
- `CI_REGISTRY_USER`
- `CI_REGISTRY_PASSWORD`
- `WECHAT_WEBHOOK`：仅在要求生成发布/部署/镜像通知时需要

前端项目通常不需要 `MAVEN_SETTINGS_XML`。Node/Vue 默认设置 `NPM_CONFIG_REGISTRY=https://registry.npmmirror.com`，pnpm 安装命令同时显式追加 `--registry=https://registry.npmmirror.com`。如果使用私有 npm 仓库，可能还需要 `NPM_TOKEN`、scope registry 或项目特定的 npm 认证变量。

实际变量以生成后的 `.gitlab-ci.yml` 为准。

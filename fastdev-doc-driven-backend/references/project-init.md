# Project Initialization

当用户要求从零创建一个符合 FastDev 风格的新项目时，优先使用既有 Maven archetype 初始化，而不是手工创建基础工程。

## Preferred Command

优先使用：

```bash
mvn -U archetype:generate \
  -DarchetypeGroupId=fast-archetype \
  -DarchetypeArtifactId=spring-cloud-newland-archetype \
  -DarchetypeVersion=2.0-SNAPSHOT
```

## 执行前确认

自动执行 archetype 命令前，先完成以下检查，任一不满足就停止并向用户报告，不要直接手工拼装一套替代架构：

- 确认目标父目录存在且可写
- 向用户确认项目坐标：`groupId`、`artifactId`、`version`、`package`
- 检查本机 JDK 和 Maven 可用，且版本满足 archetype 要求
- 检查 Maven `settings.xml` 是否配置了能访问 `fast-archetype` 私服的仓库或镜像
- 确认 archetype 坐标（`fast-archetype:spring-cloud-newland-archetype:2.0-SNAPSHOT`）可被解析；无法解析时停止并报告，不要回退到手工搭目录
- 自动执行时使用批处理参数（`-DinteractiveMode=false` 等）避免进入交互等待

## Rules

- 如果用户明确要“从零创建项目”或“初始化新工程”，优先建议或执行这个 archetype 命令
- 只有在用户明确要求不用 archetype 或 archetype 不适用时，才考虑手工初始化
- archetype 不可用或执行失败时，先报告失败原因，不要自动改用另一套架构
- 初始化完成后，再按开发文档继续补模块、接口、实体、分页等业务代码
- 如果用户只想新增模块或新增业务代码，不要误用项目初始化命令

## When To Read This File

- 用户提到“创建项目”
- 用户提到“初始化工程”
- 用户提到“从零搭一个 FastDev/Spring Cloud 项目”

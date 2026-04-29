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

## Rules

- 如果用户明确要“从零创建项目”或“初始化新工程”，优先建议或执行这个 archetype 命令
- 只有在用户明确要求不用 archetype 或 archetype 不适用时，才考虑手工初始化
- 初始化完成后，再按开发文档继续补模块、接口、实体、分页等业务代码
- 如果用户只想新增模块或新增业务代码，不要误用项目初始化命令

## When To Read This File

- 用户提到“创建项目”
- 用户提到“初始化工程”
- 用户提到“从零搭一个 FastDev/Spring Cloud 项目”

# fastdev-doc-driven-backend

这个 skill 面向 FastDev 风格的 Spring 后端项目。

它会优先读取用户提供的开发文档、表结构和可用的现有样例，再按既有工程模式生成：

- 开发方案
- 代码脚手架
- 实际后端实现

目前已经结合 `demo-server` 的典型结构做了第一版定制，包括：

- Controller / Service / ServiceImpl / Mapper / XML / Entity / DTO / Query
- `PageRequest` / `PageResponse` 分页模式，区分基础分页与自定义分页
- `@QueryField` 查询对象模式
- `@Encrypt` / `@WebSecuritySerialize` 字段加密与脱敏
- `BusinessException` 业务异常（统一走 i18n key）
- 从零初始化 FastDev/Spring Cloud 项目的 Maven archetype 流程
- `@DubboService` Dubbo 暴露
- `UserContext` 用户、角色、租户、组织与系统用户上下文

## Files

- `SKILL.md`: skill 主定义，包含场景依赖矩阵
- `references/`: 按主题拆分的细则文件，是各自主题的权威来源
- `evals/evals.json`: 测试 prompt 集合

## references 职责

- `references/base-classes.md`：`BaseController4DTO`、`BaseService4DTO`、RESTful 冲突、返回包装、业务异常构造函数与复用规则的权威来源
- `references/project-init.md`：从零初始化 FastDev 项目的 archetype 命令与执行前确认规则
- `references/crud.md`：单表 CRUD、基础分页与自定义分页、Query 对象、Mapper/XML 规则
- `references/naming.md`：表名转类名、前缀裁剪、包路径、RESTful 命名
- `references/validation.md`：参数校验、枚举、加密、逻辑删除，以及 i18n key 选择与合并原则的唯一权威来源
- `references/user-context.md`：当前用户、角色、租户、组织、系统用户与登录态判断

## 场景依赖矩阵

不同任务通常需要组合读取多个 reference，详见 `SKILL.md` 的“按场景读取”。简表：

- 单表 CRUD：`crud` + `base-classes` + `naming`，按需追加 `validation`
- 业务异常与返回包装：`base-classes`，按需追加 `validation`
- 用户/租户/组织：`user-context` + `base-classes`，按需追加 `validation`
- 校验/枚举/加密/逻辑删除/i18n：`validation`，按需追加 `crud` + `base-classes`
- 命名/包路径：`naming`，按需追加 `crud` + `base-classes`
- 从零创建项目：`project-init`，初始化后按业务继续加载上述文件

## Next Steps

1. 把你自己的开发文档示例补进 `fastdev-doc-driven-backend/evals/evals.json`
2. 如果你有新规范，优先补到 `fastdev-doc-driven-backend/references/*.md`
3. 为依赖“现有工程”的 eval 增加最小 fixture 文件，使断言可客观验证
4. 如果你希望这个 skill 更聚焦，比如“只生成 CRUD 模块”或“只处理加密字段”，可以再继续收窄范围

# fastdev-doc-driven-backend

这个 skill 面向 FastDev 风格的 Spring 后端项目。

它会先读取开发文档和现有样例，再按既有工程模式生成：

- 开发方案
- 代码脚手架
- 实际后端实现

目前已经结合 `demo-server` 的典型结构做了第一版定制，包括：

- Controller / Service / ServiceImpl / Mapper / XML / Entity / DTO / Query
- `PageRequest` / `PageResponse` 分页模式
- `@QueryField` 查询对象模式
- `@Encrypt` / `@WebSecuritySerialize` 字段加密与脱敏
- `BusinessException` 业务异常
- `@DubboService` Dubbo 暴露
- `UserContext` 用户、角色、租户、组织与系统用户上下文

## Files

- `SKILL.md`: skill 主定义
- `references/`: 按主题拆分的细则文件
- `evals/evals.json`: 测试 prompt 集合

其中：

- `references/project-init.md`: 新项目初始化规则
- `references/user-context.md`: 当前用户上下文 API 与使用边界

## Next Steps

1. 把你自己的开发文档示例补进 `fastdev-doc-driven-backend/evals/evals.json`
2. 如果你有新规范，优先补到 `fastdev-doc-driven-backend/references/*.md`
3. 如果你希望这个 skill 更聚焦，比如“只生成 CRUD 模块”或“只处理加密字段”，可以再继续收窄范围

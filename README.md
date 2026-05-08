

# Skills 技能库

本仓库包含一组用于 AI 辅助开发的技能（Skills），旨在提升开发效率和代码规范性。

## 📦 可用技能

| 技能 | 描述 | 适用场景 |
|------|------|----------|
| [fastdev-doc-driven-backend](./fastdev-doc-driven-backend/README.md) | FastDev 风格 Spring 后端项目开发 | 根据开发文档生成 Controller、Service、Mapper/XML、Entity、DTO、Query 等代码 |
| [dotnet-fastdev-backend](./dotnet-fastdev-backend/README.md) | .NET Furion + SqlSugar 后端快速开发 | 创建实体、服务、控制器、DTO、CRUD 操作、分页、验证等 |
| [git-commit](./git-commit/SKILL.md) | Git 提交规范工具 | 执行符合 Conventional Commits 规范的语义化提交 |

## 🚀 快速使用

在对话中直接描述你的需求，AI 会自动识别并调用相应的技能：

- **"根据表结构生成 CRUD"** → 触发后端开发技能
- **"参考现有模块生成代码"** → 触发后端开发技能
- **"帮我提交代码"** → 触发 Git 提交技能

## 📖 技能详情

### FastDev Doc-Driven Backend

面向 FastDev 风格的 Spring 后端项目，支持：
- 单表 CRUD、分页查询
- Controller、Service、Mapper/XML 生成
- BaseEntity、BaseController4DTO、BaseService4DTO 扩展
- 参数校验、国际化、异常处理

### .NET FastDev Backend

提供符合应用组开发规范的 ASP.NET Core 后端快速开发能力，支持：
- 基于 Newland.Furion.SqlSugar.Template 模板
- SqlSugar Repository 操作
- JWT 认证、输入验证
- RESTful API 规范

### Git Commit

符合 Conventional Commits 规范的智能提交工具：
- 自动分析 diff 确定提交类型
- 生成规范的提交信息
- 支持多种提交类型（feat/fix/docs/refactor 等）

---

> 💡 **提示**：每个技能目录下都有详细的 `SKILL.md` 和 `references/` 参考文档，可根据具体需求查阅。

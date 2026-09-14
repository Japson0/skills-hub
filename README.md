
# Skills 技能库

本仓库包含一组用于 AI 辅助开发的技能（Skills），旨在提升开发效率和代码规范性。

## 📦 可用技能

| 技能 | 描述 | 适用场景 |
|------|------|----------|
| [fastdev-doc-driven-backend](./fastdev-doc-driven-backend/README.md) | FastDev 风格 Spring 后端项目开发 | 根据开发文档生成 Controller、Service、Mapper/XML、Entity、DTO、Query 等代码 |
| [dotnet-fastdev-backend](./dotnet-fastdev-backend/README.md) | .NET Furion + SqlSugar 后端快速开发 | 创建实体、服务、控制器、DTO、CRUD 操作、分页、验证等 |
| [git-commit](./git-commit/SKILL.md) | Git 提交规范工具 | 执行符合 Conventional Commits 规范的语义化提交 |
| [openapi-codegen](./openapi-codegen/SKILL.md) | OpenAPI 接口代码生成 | 根据OpenAPI文档规范生成带类型的api接口函数和类型 |
| [gitlab-ci-generate](./gitlab-ci-generate/README.md) | .gitlab-cli.yaml生成器 | 根据当前java项目，创建从jar到K8S部署的流水线 |
| [test-behavior-sync](./test-behavior-sync/SKILL.md) | 测试行为清单同步 | 产出/更新 `tests/behavior-catalog.md`，初始化 `.test-guide.md`；不写测试代码 |
| [test-generate](./test-generate/SKILL.md) | 从行为清单生成测试 | 基于 catalog 增量生成 Vitest 测试，更新 `tests/coverage-map.md` |
| [test-run](./test-run/SKILL.md) | 执行测试并生成报告 | 运行 Vitest，归档到 `testHistory/`，失败时写入根因分析 |
| [test-debug](./test-debug/SKILL.md) | Playwright MCP E2E测试 |

## 🧪 测试技能工作流

四个 `test-*` 技能组成一条完整测试链路，建议按顺序使用：

```
/test-behavior-sync  →  /test-generate  →  /test-run  →  /test-debug（UI 场景）
     行为清单              生成 Vitest         跑测 + 报告        浏览器复现验证
```

1. **test-behavior-sync**：扫描模块、确认同步范围，产出中文行为表 `tests/behavior-catalog.md`（唯一行为真相源）
2. **test-generate**：用户审阅 catalog 后，增量生成 `*.test.ts` 与覆盖率映射，不修改生产代码
3. **test-run**：执行 Vitest，输出 `testHistory/LATEST.md`；失败时将代码根因分析写入报告而非仅留在对话中
4. **test-debug**：使用 MCP Playwright 来排查 bug 或运行 E2E 测试用例。
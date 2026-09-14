# 项目测试规范（.test-guide.md）

> 由 **test-behavior-sync** 首次运行时从模板创建。请按项目实际情况修改；后续 skill 会读取本文件。

## 语言与命名

- **behavior-catalog** 与 **测试用例描述**：使用 **中文**
- catalog ID 前缀：按模块自定义（如 `TR-01`、`ACA-03`）
- 测试文件：`tests/unit/<kebab-module>.test.ts`

## 测试范围

- **单元测试**：Vitest + @vue/test-utils（Vue）或项目默认栈
- **不写** E2E 到 `*.test.ts`（E2E 走 `/test-debug` + MCP）
- 禁止用 `it.skip` / 删断言让 CI 假绿（除非用户明确要求）

## 修复边界（Agent 可读）

- 允许：trivial import/typo（单文件 ≤10 行）
- 禁止：为通过测试而改 `@confirmed` 业务逻辑（除非用户明确选「改实现」）
- 禁止：改 reducer / IPC handler 核心分支（如有）

## Debug / 运行时（test-debug 可读）

- runtime: browser
- dev URL: http://localhost:5173
- 若 Electron 项目，改为 `runtime: electron` 并填写 CDP 端口

## 报告偏好（可选）

- testHistory 报告按模块分组
- 失败 summary 需含 catalog ID

---

*最后更新：由 test-behavior-sync 初始化*

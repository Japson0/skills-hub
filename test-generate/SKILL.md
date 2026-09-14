---
name: test-generate
description: >-
  Generate Vitest tests from tests/behavior-catalog.md (incremental merge).
  Updates tests/coverage-map.md. Only when user runs /test-generate or explicitly approves generation.
  Does NOT modify production src/. Use after test-behavior-sync catalog review.
disable-model-invocation: true
---

# Test Generate — 从行为清单生成测试

## 触发条件（必须满足其一）

- 用户执行 **`/test-generate`**
- 用户明确说：**「同意生成测试」**、「catalog 可以了」、「按清单生成测试」

未显式触发 → **拒绝生成**，提示先 `/test-behavior-sync` 并审阅 catalog。

## 前置

```bash
node ~/.cursor/skills/test-behavior-sync/scripts/detect-project.mjs
node ~/.cursor/skills/test-generate/scripts/validate-catalog.mjs
```

- 若 `hasTestGuide: false` → 提示先运行 **`/test-behavior-sync`**（会创建 `.test-guide.md`）

- `validate-catalog.mjs` 失败（exit 1）→ Agent **尝试修复** `behavior-catalog.md` 格式后重跑
- `validate-catalog.mjs` **blocked**（exit 2，JSON 含 `pendingConfirmation`）→ **停止生成**，进入下方「待确认门禁」；**不得**写任何 `*.test.*`
- 阅读 `.test-guide.md` 与 **`tests/behavior-catalog.md`**

## 待确认门禁（blocked 时必须执行）

catalog 中「场景」或「预期」含 **`待确认`** / `TBD` / `TODO:` 的行，表示需求未定。**禁止**在 generate 阶段自行假设「按当前代码实现」并继续生成。

### 流程

1. 列出 `pendingConfirmation` 中每条：**ID · 场景 · 预期（含待确认原文）**
2. 用 **AskQuestion** 逐条（或语义相近的多条合并为一问）向用户确认，选项示例：

   | 选项 | 含义 |
   |------|------|
   | A. 按当前代码实现 | 将「预期」改为**不含待确认**的明确描述（写清当前行为）；状态保持 `draft` |
   | B. 按正确业务行为 | 用户说明期望；Agent 更新「预期」为明确验收标准；状态改为 `confirmed` |
   | C. 本次不生成 | 从 catalog 删除该行，或标 `// skip generate` 备注；本次不写对应 `it()` |

3. 用户回答后 → **仅允许**更新 `tests/behavior-catalog.md` 中对应 ID 的「预期」「状态」列（及删除/备注 skip 行）→ **重跑** `validate-catalog.mjs`
4. 仍为 `blocked` → 继续 AskQuestion，**不得**生成测试
5. `blocked: false` 且 `ok: true` → 进入「生成规则」

### 禁止

- 不得用「当前实现」「代码现状」 silently 替代用户未确认的预期
- 不得跳过 AskQuestion 直接生成含待确认 ID 的测试
- 不得把待确认行为写成「文档已知 bug 但通过即绿」而不问用户

## Vitest 基建

若 `hasVitest: false` → 按 [Vitest 基建模板](reference/vitest-templates.md) 安装配置后继续。

## 生成规则

### 硬限制

- **只写** `*.test.ts` / `*.test.tsx` 与 `tests/manifest.json`、`tests/coverage-map.md`
- **禁止**修改 `src/` 生产代码（失败留给 `/test-run` 分析后由用户或 Agent 按需修复）
- **禁止**删除已有 `it()`（catalog 删行 → test 标 `// @deprecated catalog removed ID`）

### 增量合并

| catalog 变化 | 动作 |
|--------------|------|
| 新 ID | 追加对应 `it()`，注释 `// catalog: ID` |
| 改「预期」 | 只更新该 ID 的 `it()` |
| 未改 ID | 不动对应测试 |
| 状态 → confirmed | 测试 describe/注释标 `@confirmed` |

- 测试名、`it` 描述：**中文**（`.test-guide.md`）
- 每条 `it` 注释引用 catalog ID

## 覆盖率地图

生成后更新 **`tests/coverage-map.md`**（模板见 [coverage-map-template.md](reference/coverage-map-template.md)）：

| 模块 | Catalog | Tests | 说明 |
|------|---------|-------|------|
| todoReducer | 8 confirmed | 8/8 | |

顶部阶段：**「已生成，请 /test-run」**

## 完成后

1. 更新 `tests/manifest.json`（module → test file → catalog IDs）
2. 推荐安装 Vitest 扩展：
   - 名称：**Vitest**，ID：`vitest.explorer`
   - [Marketplace](https://marketplace.visualstudio.com/items?itemName=vitest.explorer)
   - 侧边栏 Testing（烧瓶）运行/调试单个用例
3. 若项目无 `.vscode/extensions.json` → 添加 `"recommendations": ["vitest.explorer"]`
4. 提示 **`/test-run`**（不修代码）
5. 单测失败且修不好时，提示 **`/test-debug <catalog-id>`**（MCP 自动复现，见 test-debug skill）

## 附加资源

- [coverage-map-template.md](reference/coverage-map-template.md)
- [validate-catalog.mjs](scripts/validate-catalog.mjs)

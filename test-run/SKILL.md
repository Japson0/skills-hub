---
name: test-run
description: >-
  Run Vitest and write structured reports to testHistory/ (LATEST.md, summary, JSON).
  On failures, MUST scan source code and write root-cause analysis INTO the report
  (summary.md) via enrich-test-report.mjs — not only in chat.
  Reads project .test-guide.md for user behavior hints. Does NOT auto-fix production or test code.
  Use for /test-run, scheduled test checks, or when the user asks to run tests or view test results.
disable-model-invocation: true
---

# Test Run — 执行测试并生成报告

## 原则

- **只跑不修**：不修改生产代码或测试代码（除非用户明确要求修复）
- 每次运行必须更新用户可见入口：`testHistory/LATEST.md`、`.cursor/test-last-run.json`
- 详细归档：`testHistory/<timestamp>/`
- **失败分析必须写入报告**：用户打开 `summary.md` 应能看到完整「代码分析」，不能只有「Agent 将扫描…」类占位话术

> **目录命名**：`test-run` → `testHistory/`（与 skill 名对应，避免与 `test-debug` 的 `debugHistory/` 混淆）

## 两阶段流程（失败时）

### 阶段 1 — 脚本跑测 + 初步 triage

```bash
node ~/.cursor/skills/test-run/scripts/run-test-report.mjs
```

脚本产出：

1. `testHistory/<timestamp>/summary.md` — 含 Vitest 报错、catalog ID、**初步线索**、**代码分析（待补充）**
2. `testHistory/LATEST.md`、`testHistory/latest.json`、`.cursor/test-last-run.json`

### 阶段 2 — Agent 静态分析并 enrich 报告（**失败时必须**）

当 `status: "fail"` 时，Agent **不得**仅把分析写在对话里就结束。必须：

1. 读 `.cursor/test-last-run.json` 的 `failures[]`（含 `fingerprint`、`catalogId`、`sourcePath`）
2. 对每条失败：读测试断言、`tests/behavior-catalog.md` 对应行、**被测源文件**（优先 `sourcePath`，其次 `tests/manifest.json`）
3. 用 graph MCP（`query_graph_tool`、`get_review_context_tool`）或 Read 定位根因
4. 将结构化分析 **写入 `summary.md` 对应失败项**（通过 `enrich-test-report.mjs` 按 `fingerprint` 替换 `<!-- failure:... -->` 块内的 **##### 代码分析**）

**Windows 必须用 UTF-8 文件传入（禁止 PowerShell `@'...'@ | node`，会乱码）：**

1. 用 Write 工具在项目根创建 `.cursor/test-run-enrich.json`（UTF-8 JSON）
2. 运行：

```bash
node ~/.cursor/skills/test-run/scripts/enrich-test-report.mjs --file .cursor/test-run-enrich.json
```

脚本会按 `fingerprint` 逐条替换 `testHistory/<timestamp>/summary.md` 中对应失败块，并更新 `report.json`、`.cursor/test-last-run.json`；完成后自动删除 `.cursor/test-run-enrich.json`。

**bash 可 pipe stdin：**

```bash
node ~/.cursor/skills/test-run/scripts/enrich-test-report.mjs <<'EOF'
{
  "analyses": [
    {
      "fingerprint": "f923581c5c23",
      "catalogId": "PG-05",
      "possibleCauses": ["currentPage computed 只 emit 不更新 props"],
      "rootCause": "emit pagination 时 getter 仍返回旧 page",
      "codeRefs": ["src/components/Pagination/index.vue:60-64"],
      "fixDirection": "改实现",
      "fixSuggestion": "用局部变量保存重置后的 page 再 emit",
      "risk": "低",
      "nextStep": "直接修 handleSizeChange"
    }
  ]
}
EOF
```

`analyses[]` 每条字段：`fingerprint`（必填，来自 test-last-run.json）、`possibleCauses`、`rootCause`、`codeRefs`、`fixDirection`、`fixSuggestion`、`risk`、`nextStep`。

5. enrich 后 `summary.md` **每条**失败项的 `<!-- failure:{fingerprint} -->` 块内应含完整 **##### 代码分析**（中文不得出现 `?` 乱码）
6. 对话中可摘要，但 **以 summary.md 为准**；禁止重复占位话术代替写入

可选环境变量：

| 变量 | 含义 | 默认 |
|------|------|------|
| `TEST_RUN_TRIGGER` | `manual` / `scheduled` / `ci` | `manual` |

## 执行前检查

1. 运行 `node ~/.cursor/skills/test-behavior-sync/scripts/detect-project.mjs`
2. 若 `hasVitest: false` 或 `hasTestScript: false` → 提示先执行 **`/test-generate`**，停止
3. 若 `hasTestGuide: false` → 提示先执行 **`/test-behavior-sync`**，或警告并继续
4. **若存在 `.test-guide.md`**：阅读用户规范；写分析、报告时须遵循
5. dev server 占用资源不影响 unit 测试

## 用户查看报告

| 场景 | 位置 |
|------|------|
| 第一眼 | `testHistory/LATEST.md` |
| 失败详情 + **代码分析** | `LATEST.md` → `.../summary.md` 中 `##### 代码分析` |
| 问 Cursor「上次测试结果」 | `.cursor/test-last-run.json` 或 `LATEST.md` |

## summary.md 失败项结构（固定）

每条失败用 `<!-- failure:{fingerprint} -->` 包裹，便于 enrich 替换：

```markdown
#### {测试名}

- **文件**: `{testFile}`
- **Catalog**: PG-05 @confirmed
- **被测源文件**: `src/components/Pagination/index.vue`
- **预期 vs 实际**: ...
- **Vitest 报错**: ...
- **判断**: Logic-Bug · PG-05
- **初步线索**: PG-05 · 业务逻辑与预期不符 · ...

##### 代码分析

- **可能原因**:
  - ...
- **根因**: ...
- **相关代码**: `src/...:60-64`
- **建议修复方向**: 改实现
- **修复建议**: ...
- **风险**: 低
- **下一步**: ...
```

阶段 1 未 enrich 时，「代码分析」显示 **待 Agent 静态扫描后写入**；阶段 2 完成后必须替换为上述完整内容。

## 自动 Triage（脚本内置）

`triage-failures.mjs` 负责：

- 从 `tests/behavior-catalog.md` 解析 **任意前缀** catalog ID（`PG-05`、`ICR-01` 等）
- 从 `tests/manifest.json` 解析 **被测源文件**（不再臆造 `src/views/Xxx.vue`）
- 从测试文件 `// catalog: XX-xx` 注释关联 ID
- 解析常见 AssertionError（含 `deeply equal`、`toHaveBeenCalled`）
- 写入 **初步线索**（非最终修复建议）

### 失败分类

| 类型 | 说明 |
|------|------|
| `Trivial-Test` | 测试代码 typo、import 错误 |
| `Trivial-Prod` | 生产代码明显 typo |
| `Spec-Drift` | 实现与 @confirmed catalog 不一致 |
| `Logic-Bug` | 业务逻辑错误 |
| `Draft-Unconfirmed` | @draft 失败，需 test-behavior-sync |
| `Integration` | mock/IPC/异步时序 |
| `Flaky` | 不稳定 |

## 失败时代码分析（Agent 必做，写入报告）

当 `status: "fail"` 时：

1. 跑完阶段 1 脚本
2. 对 **每条** `failures[]` 做静态分析（字段见 enrich JSON）
3. 调用 **enrich-test-report.mjs** 写入 `summary.md` / `test-last-run.json`
4. 对话输出简要摘要 + 指向 `summary.md` 链接

**禁止**：

- 仅转发 LATEST.md 而不 enrich
- 在「修复建议」里写「Agent 将扫描源码…」类空话（应写入具体根因与改法）
- 默认推荐 `/test-debug`（见下）

### 何时才推荐 `/test-debug`

**默认不推荐。** 仅当静态分析仍无法确认根因，或修复影响面大时，在 **下一步** 中建议 `/test-debug <catalog-id>`：

| 场景 | 示例 |
|------|------|
| Integration / 异步竞态 | loading 时序、未 await、竞态 |
| 复杂 UI 交互 | 多步表单、路由、真实 DOM 事件链 |
| 环境依赖 | 真实 API、Electron CDP |
| 影响面大 | 跨模块、核心 reducer、多处 @confirmed |

**不应推荐 `/test-debug`**：单函数逻辑、断言一眼可对的差异、明显 typo。

### 其他失败类型

- `@draft` → **test-behavior-sync** 确认需求
- **Trivial-Test / Trivial-Prod** → enrich 中给出具体改法

## 全绿时

`LATEST.md` 顶部 ✅；`test-last-run.json` 的 `status: "pass"`。无需 enrich。

## 定时任务

配合 **loop** skill：`/loop 6h /test-run`。设置 `TEST_RUN_TRIGGER=scheduled`。

## 附加资源

- 报告模板：[reference/test-history-template.md](reference/test-history-template.md)
- 脚本：`scripts/run-test-report.mjs`、`scripts/triage-failures.mjs`、`scripts/enrich-test-report.mjs`（`--file` UTF-8 JSON，写入 summary 对应 failure 块）

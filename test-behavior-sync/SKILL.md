---
name: test-behavior-sync
description: >-
  Produce or update tests/behavior-catalog.md (behavior spec in Chinese tables).
  Creates .test-guide.md on first run. Asks sync scope; stops and AskQuestion on ambiguous behaviors.
  Reads OpenSpec; may init OpenSpec and suggest /opsx:explore.
  Does NOT generate test code. Use for /test-behavior-sync. User runs test-generate after approving catalog.
disable-model-invocation: true
---

# Test Behavior Sync — 产出行为清单

## 目标

产出或更新 **`tests/behavior-catalog.md`**（唯一行为真相源）。**不写测试代码**。

用户审阅/修改 catalog 后，显式执行 **test-generate**（`/test-generate` 或「同意生成测试」）。

## 前置（首次运行会创建 `.test-guide.md`）

```bash
node ~/.cursor/skills/test-behavior-sync/scripts/ensure-test-guide.mjs
node ~/.cursor/skills/test-behavior-sync/scripts/detect-project.mjs
node ~/.cursor/skills/test-behavior-sync/scripts/scan-modules.mjs
```

- **`ensure-test-guide.mjs`**：若项目根无 `.test-guide.md` → 从模板创建，并初始化 `.cursor/test-profile.json`（若不存在）
- 读取：`projectType`、`hasOpenSpec`、`hasTestGuide`、scan 输出的 `modules` / `uncovered`
- 用户应审阅并编辑新建的 `.test-guide.md`（语言、命名、auto-fix 边界等）

> **test-sync 已废除**：项目测试规范与探测脚本现归属 **test-behavior-sync**。

## 同步范围 — AskQuestion

默认选项（可附预估模块数；全项目若 >8 模块须警告审阅负担）：

| 选项 | 含义 |
|------|------|
| A. 本次 git 变更涉及模块 | 推荐日常 |
| B. 全项目未覆盖模块 | bootstrap；模块多时报「预计 N 个模块，建议分批」 |
| C. 自定义（用户指定模块名） | |

写入 catalog frontmatter 的 `scope`。

## OpenSpec（`openspec: use` 且无 `.openspec/`）

1. 询问是否初始化（AskQuestion）
2. 若同意，终端执行（需用户确认）：
   ```bash
   npm install -g @fission-ai/openspec@latest
   openspec init
   ```
   选择 **Cursor**
3. 引导对话探索：
   ```
   /opsx:explore 梳理 [模块名] 的测试行为与验收标准
   ```
4. explore 结论合并进 catalog，`来源` 列标 `openspec`

若用户选跳过 → `testProfile.openspec: "skip"`。

## 待确认门禁（**sync 阶段必须执行，优先级高于写 catalog**）

从代码分析 catalog 时，若出现以下任一情况，视为**需求未定**，**不得**自行假设后写入 catalog 并结束流程：

| 触发条件 | 示例 |
|----------|------|
| 实现与合理业务预期不一致 | INIT 未恢复 preferences，重启丢背景 |
| 边界行为代码未定义/会抛错 | `saveBlobToLocal(null)` 写文件还是拒绝 |
| 产品规则不明确 | 未裁剪能否提交、是否提示用户 |
| 多种合理验收标准 | 按现状测 bug vs 按正确行为测 |

### 流程（**必须 AskQuestion，不得跳过**）

1. **先分析、后提问**：通读 scope 内模块，列出所有「不确定点」（每条对应将来一个 catalog ID 或一组语义相近 ID）。
2. **停下流程**：在写入/更新 `behavior-catalog.md` **之前**，用 **AskQuestion** 向用户逐条（或语义相近合并为一问）确认。
3. **选项模板**（可按条微调文案）：

   | 选项 | 含义 |
   |------|------|
   | A. 按当前代码实现 | 「预期」写清**当前行为**；`来源`=`code`；`状态`=`draft` |
   | B. 按正确业务行为 | 用户补充期望；「预期」写明确验收标准；`来源`=`user`；`状态`=`confirmed` |
   | C. 暂不纳入清单 | 本次不写该行；若已有旧行则保留并备注「本次 scope 跳过」 |

4. **用户回答之后**才允许：
   - 写入/更新 catalog 对应行的「场景」「预期」「来源」「状态」
   - **禁止**在「预期」列留 `待确认` / `TBD` / `TODO:` 作为交付物
5. 若用户尚未回答 → **不得**输出 sync 完成结束语，不得提示「去 /test-generate」。

### 禁止（sync 阶段）

- **禁止**用「当前实现」「代码现状」 silently 填「预期」并标 `待确认` 交给用户以后再看
- **禁止**用「待确认」备注代替 AskQuestion（审表不能替代当面确认）
- **禁止**在仍有未提问/未回答的不确定点时写完 catalog 就说「请审阅后 generate」

### sync 收尾校验（可选但推荐）

用户答完并更新 catalog 后：

```bash
node ~/.cursor/skills/test-generate/scripts/validate-catalog.mjs
```

- `blocked: true` 或 exit 2 → 说明仍有「待确认」残留，**回到 AskQuestion**，不得结束 sync
- `ok: true` 且 `blocked: false` → 可进入下方「完成后」

## 产出 behavior-catalog.md

- 无文件 → 从 [behavior-catalog-template.md](reference/behavior-catalog-template.md) 创建
- 有文件 → **增量合并**：只增/改本次 scope 内模块，不删已有 `@confirmed` 行
- **仅写入用户已确认预期**的行（见上方门禁）

### 表格列（固定，勿改表头）

| ID | 场景 | 预期 | 来源 | 状态 |

- **ID**：`模块前缀-序号`（如 `TR-01`、`ACA-03`）
- **来源**：`openspec` | `user` | `code`
- **状态**：`draft` | `confirmed`（用户选 B 或明确确认 → `confirmed`；用户选 A → `draft`）

### 写作要求

- 遵循 `.test-guide.md`（中文场景与预期）
- 「预期」列必须是**可执行断言**的明确描述，不含模糊用语
- 每条 ID 将来对应一个 `it()`；场景/预期必须可人工判读

## 完成后（固定结束语，**仅当待确认门禁已通过**）

1. 告知路径：`tests/behavior-catalog.md`
2. **请打开审阅**，可直接改表格；格式乱了 Agent 在 generate 时会尝试修复
3. 满意后执行 **`/test-generate`** 或说 **「同意生成测试」**
4. **不要**在本 skill 内生成 `*.test.*` 或改 `src/` 生产代码

## 附加资源

- 模板：[reference/behavior-catalog-template.md](reference/behavior-catalog-template.md)、[reference/test-guide-template.md](reference/test-guide-template.md)
- 脚本：`scripts/scan-modules.mjs`、`scripts/ensure-test-guide.mjs`、`scripts/detect-project.mjs`
- generate 侧二次门禁：`../test-generate/scripts/validate-catalog.mjs`（`blocked` / exit 2）

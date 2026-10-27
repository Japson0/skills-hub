---
name: test-debug
description: >-
  Playwright MCP mandatory runtime verification for catalog scenarios. MUST complete
  full catalog reproduction via Playwright MCP before any code changes or conclusions.
  NOT Cursor IDE Debug/breakpoints. Use for /test-debug, @test-debug, MCP debug.
  Do NOT bypass Playwright or ask user to manually verify.
---

# Test Debug — Playwright MCP 强制运行时验证

**本 skill 的唯一目的**：用 **Playwright MCP** 在真实浏览器中按 behavior-catalog 场景操作并验证预期。  
不是 Cursor 断点调试，不是静态读代码猜 bug。

## 与 Cursor Debug 的区别

| | **test-debug** | **Cursor Debug** |
|--|----------------|------------------|
| 工具 | **仅 Playwright MCP** | IDE 断点 |
| 谁操作 UI | Agent 自动 | 用户手动 |
| 入口 | `/test-debug ICR-04` | Run and Debug 面板 |

详见 [cursor-debug-vs-mcp.md](reference/cursor-debug-vs-mcp.md)。

---

## 强制门控（Agent 必须遵守，不可绕过）

### Gate 0 — 初始化（一条命令）

```bash
node ~/.cursor/skills/test-debug/scripts/init-debug.mjs --catalog-id <ID>
```

读取 JSON：`gate`、`sessionDir`、`reportPath`、`rendererUrl`、`catalogRow`。

- `gate === "MCP_UNAVAILABLE"` → **立即停止**，告知配置 [mcp-setup.md](reference/mcp-setup.md)，**禁止**改代码、禁止假装复现
- `gate === "MCP_READY"` → 进入 Gate 1

### Gate 0.5 — Auth（需登录 Web 项目）

在 Playwright 导航业务页**之前**执行。读 `.cursor/test-profile.json` 的 `debug.auth`；无该段则跳过。

1. 运行 `debug.auth.checkScript`
2. 有效 session → Playwright 注入 localStorage（见 [auth-playbook-keycloak.md](reference/auth-playbook-keycloak.md)）
3. 无 session → 向用户索要测试账号密码；**禁止**让用户手动登录 SSO
4. 登录页 fail-fast → 标 `Auth-Blocked`，**禁止**改代码收尾

**禁止**将 password / 完整 token 写入 report 或截图目录。

### Gate 1 — Playwright 不可绕过

当 `gate === "MCP_READY"` 时，**全部** UI 操作与观测 **仅** 通过 Playwright MCP（`CallMcpTool` → `user-playwright`）：

| 允许 | 禁止 |
|------|------|
| `browser_navigate` / `browser_click` / `browser_fill_form` / `browser_type` / `browser_select_option` | 未跑 Playwright 就改 `src/` |
| `browser_snapshot` / `browser_take_screenshot` / `browser_console_messages` | 仅调用 1 次 MCP 就下结论 |
| 按 catalog「场景」逐步操作至「预期」可验证 | 「我已经帮你打开了，剩下你自己验证」 |
| Auth Gate 前的 token 脚本 | 「请手动点击…」「你可以试一下…」 |
| 读代码 **辅助定位元素**（不改代码） | 用静态分析替代 Playwright 复现 |
| | 使用 Chrome DevTools MCP 代替 Playwright |
| | `browser_close` 在场景未完成前 |

**完成 catalog 场景前禁止修改 `src/` 或测试文件**（`Test-Wrong` 也须先 Playwright 确认）。

### Gate 2 — Playwright 工作流

```
0. Auth 注入（若需要）
1. browser_navigate → rendererUrl
2. 按 catalog「场景」逐步 click/fill/navigate
3. browser_snapshot — 验证 catalog「预期」是否成立
4. browser_take_screenshot → <sessionDir>/screenshot.png
5. 若有 console 错误：browser_console_messages，摘要写入 report.md
6. 填写 report.md verdict，再决定是否改代码
```

操作 playbook：[mcp-playbook.md](reference/mcp-playbook.md)

### Gate 3 — 完成条件（精简产物）

向用户报告前，**必须**存在：

- `<sessionDir>/report.md` — 含操作摘要、运行时观察、**verdict**
- `<sessionDir>/screenshot.png` — 最终态截图

**不再要求**：`session.json`、`reproduction.md`、`diagnosis.md`、`evidence/` 子目录、`mcp-gate.json`。

report 模板：[report-template.md](reference/report-template.md)

---

## verdict 分类

| verdict | 下一步 |
|---------|--------|
| `Pass` | catalog 预期在浏览器中成立，无需改代码 |
| `Test-Wrong` | Playwright 确认后改测试 |
| `Prod-Bug` | Playwright 确认后改 `src/` |
| `Spec-Drift` | catalog 与产品理解偏差，先对齐 catalog |
| `Auth-Blocked` | 修复 token / 账号，重新 Gate 0.5 |
| `Nav-Blocked` | 无法导航到目标页，补充导航步骤或路由信息 |
| `MCP-Unavailable` | 配置 Playwright MCP，终止 |

---

## 触发方式

- `/test-debug`、`/test-debug ICR-04`
- `@test-debug`
- 「MCP 自动复现」「不要让我手动点」

若用户只要 IDE 断点 → 说明用 Cursor Debug，**不用本 skill**。

---

## 执行前检查

1. `init-debug.mjs --catalog-id <ID>`
2. 读 `tests/behavior-catalog.md` 对应行
3. 读 `.test-guide.md`、`.cursor/test-profile.json`
4. **读 Playwright MCP tool schema**（`mcps/user-playwright/tools/`）再 `CallMcpTool`

---

## Agent 工作流（摘要）

```
Gate 0: init-debug.mjs → MCP_READY?
Gate 0.5: auth（若需要）
Gate 1: Playwright 跑完 catalog 场景 + 验证预期（禁止改代码）
Gate 2: screenshot + report.md verdict
Gate 3: 按 verdict 改代码或结束
```

---

## 常见问题

| 现象 | 处理 |
|------|------|
| waiting for approval | Cursor Settings → Agents → Auto-Run MCP |
| cursor-ide-browser 冲突 | 移除 `.cursor/mcps/cursor-ide-browser` |
| 找不到表单/入口 | verdict `Nav-Blocked`，在 report 写明已尝试步骤 |

---

## 产出目录

`debugHistory/<catalogId>-latest/`

```
report.md
screenshot.png
```

---

## 与 test-run

- test-run 失败 → 静态分析；**仅当需要运行时证据**时建议 `/test-debug <id>`
- test-debug 完成后可 `/test-run` 验证

---

## 附加资源

- [cursor-debug-vs-mcp.md](reference/cursor-debug-vs-mcp.md)
- [mcp-setup.md](reference/mcp-setup.md)
- [mcp-playbook.md](reference/mcp-playbook.md)
- [auth-playbook-keycloak.md](reference/auth-playbook-keycloak.md)
- [report-template.md](reference/report-template.md)

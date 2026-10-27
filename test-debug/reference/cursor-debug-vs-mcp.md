# Cursor Debug 模式 vs test-debug（Playwright MCP）

## 两套系统

| | **test-debug** | **Cursor Debug** |
|--|----------------|------------------|
| 入口 | `/test-debug ICR-04` | Run and Debug 面板 |
| 工具 | **仅 Playwright MCP** | 断点、调用栈、变量 |
| 谁操作 UI | Agent 自动 | 用户 |
| 产出 | `debugHistory/<id>-latest/report.md` + `screenshot.png` | 调试会话 |

对话里只说「debug 这个 bug」**不会**自动加载 test-debug；须显式 `/test-debug` 或 `@test-debug`。

## test-debug 不可绕过 Playwright

- 必须跑完 catalog 场景才能改代码或下结论
- MCP 不可用 → **终止**，不退化为静态分析
- **禁止**「我帮你打开了，剩下你自己验证」

## Cursor 设置

- **Agents → Auto-Run Mode**：Run MCP tools，避免 approval 卡住
- **MCP**：配置 Playwright（见 [mcp-setup.md](mcp-setup.md)）
- 移除 `cursor-ide-browser` MCP（与 Playwright 冲突）

## 推荐串行

```
/test-debug <id>  →  Playwright 复现 + report verdict
改代码（若 Prod-Bug / Test-Wrong）
/test-run 验证
```

需要 IDE 断点时，**在 test-debug 完成之后**再用 Cursor Debug，不要与 Playwright 同时控制同一页。

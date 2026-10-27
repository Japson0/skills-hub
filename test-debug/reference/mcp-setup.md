# MCP 配置指南（Playwright）

test-debug **仅**使用 Playwright MCP。未配置则 skill 在 Gate 0 终止。

## 安装

**Cursor Settings → MCP → Add new MCP Server**

| 字段 | 值 |
|------|-----|
| Name | `playwright` |
| Type | command |
| Command | `npx @playwright/mcp@latest` |

验证：项目 `mcps/user-playwright/tools/` 下可见 `browser_navigate`、`browser_click`、`browser_snapshot` 等。

或运行：

```bash
node ~/.cursor/skills/test-debug/scripts/verify-mcp-available.mjs
```

应输出 `"gate": "MCP_READY"`。

## dev URL

在 `.cursor/test-profile.json` 或 `.test-guide.md` 中设置：

```json
{
  "debug": {
    "rendererUrl": "https://localhost:3001"
  }
}
```

## 常见问题

| 现象 | 处理 |
|------|------|
| Agent 卡在 waiting for approval | Cursor Settings → Agents → Auto-Run MCP |
| Playwright 与 cursor-ide-browser 冲突 | 移除 `.cursor/mcps/cursor-ide-browser` |
| gate MCP_UNAVAILABLE | 重启 Cursor，确认 MCP 面板中 playwright 已连接 |

## 安全

Playwright 控制的浏览器可访问本地 dev 服务。Debug 期间勿处理生产敏感数据。

# Keycloak Auth Playbook（browser-url · 不改业务代码）

适用：项目 `.cursor/test-profile.json` 中 `debug.auth.strategy === "keycloak-password-grant"`。

## 1. Auth Gate（在 Phase A 之前）

```bash
node scripts/debug-get-token.mjs --check
```

| 结果 | 动作 |
|------|------|
| `ok: true`, `source: cache` | 直接进入 MCP 注入 |
| `NO_VALID_SESSION` | **向用户索要**测试账号 + 密码（可问角色），**禁止**让用户手动点 SSO |
| 用户提供后 | 见下方「换 token」 |

### 换 token（密码仅经环境变量，不落盘）

**PowerShell：**

```powershell
$env:DEBUG_AUTH_USERNAME="账号"
$env:DEBUG_AUTH_PASSWORD="密码"
node scripts/debug-get-token.mjs
```

**bash：**

```bash
DEBUG_AUTH_USERNAME=账号 DEBUG_AUTH_PASSWORD=密码 node scripts/debug-get-token.mjs
```

脚本 stdout 含 `injection.localStorage`，供 MCP 使用。  
同一条 Cursor 对话内后续 `/test-debug` **先 `--check`**，有效则不再问密码。

### 安全

- **禁止**将 password / 完整 token 写入 `report.md` 或截图目录
- 可记录：`username`、「已通过 password grant 认证」、`source: cache|fresh`
- `.cursor/debug-session.json` 仅存 token，已在 `.gitignore`

---

## 2. Playwright MCP 注入（Phase A 第一步）

在 `browser_navigate` 到业务页 **之前**：

1. `browser_navigate` → `about:blank`
2. `browser_evaluate` — 写入 localStorage（键名见 test-profile `localStorageKeys`）：

```javascript
() => {
  localStorage.setItem('cloud-token', '<access_token>');
  localStorage.setItem('_kc_refresh', '<refresh_token>');
}
```

3. `browser_navigate` → `debug.rendererUrl`（默认 `http://localhost:5173`）
4. `browser_wait_for` — 等待 3～5s 或直到已登录 UI（头像 / 菜单）
5. 可选：`browser_take_screenshot` → `debugHistory/<catalogId>-latest/screenshot.png`
6. 若项目已生成 `.cursor/debug-auth.json` storageState，后续 session 可优先加载

### 失败：仍出现登录页 / SSO 域名

**立即停止** click/fill，不要尝试 Keycloak UI。

1. 标记 `Auth-Blocked`
2. 删除或忽略无效 `debug-session.json`
3. 重新 Auth Gate（向用户确认账号或换账号）

`loginPageHosts` 见 test-profile：`auth-test.uusima.com` 等。

---

## 3. 与 `?token=` URL 的区别

本项目 **不要** 仅用 `?token=` 注入：缺少 `_kc_refresh` 时 `keycloak.authenticated` 可能为 false，API 不带 Bearer。  
必须同时写入 `cloud-token` + `_kc_refresh`。

---

## 4. Token 过期

- 脚本缓存过期或 `--check` 失败 → 再问用户密码（可提示「仍用账号 xxx？」）
- 浏览器 session 内 Keycloak adapter 可能自动 refresh；401 时回到 Auth Gate

---

## 5. 租户（可选）

若账号需指定租户，换 token 前设置：

```bash
DEBUG_TENANT_ID=<tenant_id> node scripts/debug-get-token.mjs
```

MCP 注入时同步：

```javascript
localStorage.setItem('_tenant_id', '<tenant_id>');
```

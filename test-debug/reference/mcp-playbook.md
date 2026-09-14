# Playwright MCP Playbook

## 1. 启动 dev server

```bash
npm run dev
```

等待 `init-debug.mjs` 输出的 `rendererUrl` 可访问。

## 2. Auth（若项目配置了 debug.auth）

见 [auth-playbook-keycloak.md](auth-playbook-keycloak.md)：`about:blank` → `browser_evaluate` 注入 localStorage → `browser_navigate` 业务页。

## 3. 按 catalog 场景操作

1. `browser_navigate` → `rendererUrl`（或业务 deep link）
2. 按 catalog「场景」：
   - 输入 → `browser_type` / `browser_fill_form`
   - 点击 → `browser_click`（优先 role/name）
   - 选择 → `browser_select_option`
3. `browser_snapshot` — 验证 catalog「预期」文案/状态是否可见
4. `browser_take_screenshot` → `debugHistory/<catalogId>-latest/screenshot.png`
5. 若有异常：`browser_console_messages`，摘要写入 report.md

## 4. 完成前禁止

- 未完成场景就 `browser_close`
- 未写 report verdict 就改 `src/`
- 把验证推给用户（「你自己点一下」）

## 5. 常见坑

- Element Plus / antd 按钮 accessible name 可能有空格 → 用 snapshot 中的 ref 或正则
- Select 下拉需先 click 触发器再选 option
- 弹窗/MessageBox 在 snapshot 中确认后再操作内部按钮

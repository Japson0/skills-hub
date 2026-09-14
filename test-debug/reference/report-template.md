# Report 模板

复制到 `debugHistory/<catalogId>-latest/report.md` 并填写。

---

# Debug · {{catalogId}}

**时间**：{{isoTime}}
**URL**：{{rendererUrl}}
**场景**：{{scenario}}
**预期**：{{expected}}

## Playwright 操作摘要

1. browser_navigate → …
2. browser_click / browser_fill_form → …
3. browser_snapshot → （预期是否可见）

## 运行时观察

- UI：
- Console：

## Verdict

`{{verdict}}` — Pass | Test-Wrong | Prod-Bug | Spec-Drift | Auth-Blocked | Nav-Blocked

## 下一步

1.

## 附件

- `screenshot.png`

# Vitest 基建模板（test-generate 使用）

当 `detect-project.mjs` 输出 `hasVitest: false` 时，按项目类型安装并配置。

## Vue + Vite（推荐）

```bash
npm install -D vitest @vue/test-utils jsdom
```

`vite.config.ts` 增加：

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

`package.json` scripts：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

测试目录：`tests/unit/*.test.ts`

## React + Vite

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

## 可选：VS Code 扩展

`.vscode/extensions.json`：

```json
{
  "recommendations": ["vitest.explorer"]
}
```

## .gitignore 建议

```
testHistory/
debugHistory/
.cursor/test-last-run.json
```

可选保留 `testHistory/LATEST.md` 便于团队查看最后一次结果。

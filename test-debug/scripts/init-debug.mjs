#!/usr/bin/env node
/**
 * One-shot init: verify Playwright MCP + resolve URL + create session dir + report stub.
 * Usage: node init-debug.mjs --catalog-id ICR-04
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const cwd = process.cwd()
const catalogIdArg = process.argv.includes('--catalog-id')
  ? process.argv[process.argv.indexOf('--catalog-id') + 1]
  : null

if (!catalogIdArg) {
  console.error(JSON.stringify({ ok: false, error: 'MISSING_CATALOG_ID' }))
  process.exit(1)
}

const catalogId = catalogIdArg

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

function parseCatalogRow(id) {
  const catalog = readText(join(cwd, 'tests/behavior-catalog.md'))
  for (const line of catalog.split('\n')) {
    if (!line.startsWith('|') || line.includes('----')) continue
    const cols = line.split('|').map((c) => c.trim()).filter(Boolean)
    if (cols[0] === id) {
      return { id: cols[0], scenario: cols[1], expected: cols[2], source: cols[3], status: cols[4] }
    }
  }
  return null
}

function findPlaywrightMcp() {
  const projectMcps = join(cwd, 'mcps')
  if (!existsSync(projectMcps)) return null
  const servers = readdirSync(projectMcps, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /playwright/i.test(d.name))
    .map((d) => ({ name: d.name, path: join(projectMcps, d.name) }))
  return servers[0] ?? null
}

function listPlaywrightTools(serverPath) {
  const toolsDir = join(serverPath, 'tools')
  if (!existsSync(toolsDir)) return []
  return readdirSync(toolsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
}

function verifyPlaywright(tools) {
  const canOperate = tools.some((t) => /click|fill|type|navigate/i.test(t))
  const canObserve = tools.some((t) => /console|snapshot|screenshot/i.test(t))
  return { canOperate, canObserve, ok: canOperate && canObserve }
}

function guessRendererUrl(debugProfile) {
  if (debugProfile.rendererUrl) return debugProfile.rendererUrl
  const guide = readText(join(cwd, '.test-guide.md'))
  const urlMatch = guide.match(/dev URL:\s*(\S+)/i)
  if (urlMatch) return urlMatch[1]
  const pkg = readJson(join(cwd, 'package.json'), {})
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  if (deps.next) return 'http://localhost:3000'
  return 'http://localhost:5173'
}

function pickDevCommand(scripts) {
  if (scripts.dev) return 'npm run dev'
  if (scripts.start) return 'npm start'
  return null
}

const catalogRow = parseCatalogRow(catalogId)
if (!catalogRow) {
  console.error(JSON.stringify({ ok: false, error: 'CATALOG_ID_NOT_FOUND', catalogId }))
  process.exit(2)
}

const playwrightServer = findPlaywrightMcp()
const playwrightTools = playwrightServer ? listPlaywrightTools(playwrightServer.path) : []
const pwCheck = verifyPlaywright(playwrightTools)

const testProfile = readJson(join(cwd, '.cursor/test-profile.json'), {})
const debugProfile = testProfile.debug ?? {}
const pkg = readJson(join(cwd, 'package.json'), {})
const rendererUrl = guessRendererUrl(debugProfile)
const devCommand = pickDevCommand(pkg.scripts ?? {})

const historyRoot = 'debugHistory'
const relSession = `${historyRoot}/${catalogId}-latest`
const sessionDir = join(cwd, relSession)
mkdirSync(sessionDir, { recursive: true })

const gate = pwCheck.ok ? 'MCP_READY' : 'MCP_UNAVAILABLE'
const reportPath = `${relSession}/report.md`
const screenshotPath = `${relSession}/screenshot.png`

const reportStub = `# Debug · ${catalogId}

**时间**：${new Date().toISOString()}
**URL**：${rendererUrl}
**场景**：${catalogRow.scenario}
**预期**：${catalogRow.expected}

## Playwright 操作摘要

（Agent：逐步记录 navigate / click / fill / snapshot 结果）

## 运行时观察

- UI：
- Console：

## Verdict

\`Pending\` — Pass | Test-Wrong | Prod-Bug | Spec-Drift | Auth-Blocked | Nav-Blocked

## 下一步

1.
`

writeFileSync(join(sessionDir, 'report.md'), reportStub)

const result = {
  ok: pwCheck.ok,
  gate,
  catalogId,
  catalogRow,
  sessionDir: relSession,
  reportPath,
  screenshotPath,
  rendererUrl,
  devCommand,
  playwright: playwrightServer
    ? { server: playwrightServer.name, tools: playwrightTools.length, ...pwCheck }
    : null,
  mcpRequired: 'playwright-only',
}

console.log(JSON.stringify(result, null, 2))
process.exit(pwCheck.ok ? 0 : 2)

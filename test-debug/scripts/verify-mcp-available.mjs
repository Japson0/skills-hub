#!/usr/bin/env node
/**
 * Check Playwright MCP is available (required for test-debug).
 * Usage: node verify-mcp-available.mjs
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const cwd = process.cwd()

function findPlaywrightServer() {
  const projectMcps = join(cwd, 'mcps')
  if (!existsSync(projectMcps)) return null
  const entry = readdirSync(projectMcps, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /playwright/i.test(d.name))
    .map((d) => ({ name: d.name, path: join(projectMcps, d.name) }))[0]
  return entry ?? null
}

function listTools(serverPath) {
  const toolsDir = join(serverPath, 'tools')
  if (!existsSync(toolsDir)) return []
  return readdirSync(toolsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
}

const playwrightServer = findPlaywrightServer()
const playwrightTools = playwrightServer ? listTools(playwrightServer.path) : []

const canOperate = playwrightTools.some((t) => /click|fill|type|navigate/i.test(t))
const canObserve = playwrightTools.some((t) => /console|snapshot|screenshot/i.test(t))
const ok = canOperate && canObserve

const result = {
  ok,
  playwright: playwrightServer
    ? { server: playwrightServer.name, tools: playwrightTools.length }
    : null,
  canOperate,
  canObserve,
  recommendation: 'Playwright MCP only — browser_navigate → catalog steps → browser_snapshot → screenshot',
  gate: ok ? 'MCP_READY' : 'MCP_UNAVAILABLE',
}

console.log(JSON.stringify(result, null, 2))
process.exit(ok ? 0 : 2)

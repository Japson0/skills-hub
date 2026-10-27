#!/usr/bin/env node
/**
 * Resolve browser dev URL and dev command for Playwright MCP.
 * Usage: node detect-debug-strategy.mjs [--catalog-id ICR-04]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const cwd = process.cwd()
const catalogId = process.argv.includes('--catalog-id')
  ? process.argv[process.argv.indexOf('--catalog-id') + 1]
  : null

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

const pkg = readJson(join(cwd, 'package.json'), {})
const deps = { ...pkg.dependencies, ...pkg.devDependencies }
const scripts = pkg.scripts ?? {}

let projectType = 'unknown'
if (deps.next) projectType = 'next'
else if (deps.vite) projectType = 'vite'
else if (deps['react-scripts']) projectType = 'cra'

const testProfile = readJson(join(cwd, '.cursor/test-profile.json'), {})
const debugProfile = testProfile.debug ?? {}

function guessRendererUrl() {
  if (debugProfile.rendererUrl) return debugProfile.rendererUrl
  const guide = readText(join(cwd, '.test-guide.md'))
  const urlMatch = guide.match(/dev URL:\s*(\S+)/i)
  if (urlMatch) return urlMatch[1]
  if (projectType === 'next') return 'http://localhost:3000'
  return 'http://localhost:5173'
}

function pickDevCommand() {
  if (scripts.dev) return 'npm run dev'
  if (scripts.start) return 'npm start'
  return null
}

const rendererUrl = guessRendererUrl()
const historyRoot = 'debugHistory'

const result = {
  ok: true,
  projectType,
  catalogId,
  strategy: 'browser-url',
  strategyLabel: 'Browser Dev Server（Playwright MCP）',
  devCommand: pickDevCommand(),
  rendererUrl,
  playwright: {
    mode: 'navigate',
    startUrl: rendererUrl,
    note: 'browser_navigate 到 dev server，按 catalog 场景操作并验证预期',
  },
  mcpRequired: ['playwright'],
  historyRoot,
  warnings: [],
}

console.log(JSON.stringify(result, null, 2))

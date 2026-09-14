#!/usr/bin/env node
/**
 * Detect project test stack and conventions file presence.
 * Usage: node ~/.cursor/skills/test-behavior-sync/scripts/detect-project.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const cwd = process.cwd()

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

const pkg = readJson(join(cwd, 'package.json'), {})
const deps = { ...pkg.dependencies, ...pkg.devDependencies }
const scripts = pkg.scripts ?? {}

let projectType = 'unknown'
let framework = 'unknown'
if (deps['electron-vite'] || deps.electron) projectType = 'electron-vite'
else if (deps.next) projectType = 'next'
else if (deps.nuxt) projectType = 'nuxt'
else if (deps.vite) projectType = 'vite'
else if (deps['react-scripts']) projectType = 'cra'

if (deps.vue || existsSync(join(cwd, 'src/App.vue'))) framework = 'vue'
else if (deps.react || deps['react-dom']) framework = 'react'

let rendererPath = 'src'
if (projectType === 'electron-vite') rendererPath = 'src/renderer/src'

const hasVitest =
  !!(deps.vitest || deps['@vitest/ui']) ||
  existsSync(join(cwd, 'vitest.config.ts')) ||
  existsSync(join(cwd, 'vitest.config.mjs'))
const hasTestScript = !!(scripts.test || scripts['test:unit'])
const hasTestGuide = existsSync(join(cwd, '.test-guide.md'))
const hasCatalog = existsSync(join(cwd, 'tests/behavior-catalog.md'))
const hasOpenSpec =
  existsSync(join(cwd, '.openspec')) ||
  existsSync(join(cwd, 'openspec')) ||
  existsSync(join(cwd, 'openspec/config.yaml'))

const result = {
  ok: true,
  projectType,
  framework,
  rendererPath,
  hasVitest,
  hasTestScript,
  hasTestGuide,
  hasCatalog,
  hasOpenSpec,
  readyForBehaviorSync: true,
  readyForGenerate: hasCatalog && hasTestGuide,
  readyForTestRun: hasVitest && hasTestScript,
}

console.log(JSON.stringify(result, null, 2))

if (!hasTestGuide) process.exit(0)
process.exit(0)

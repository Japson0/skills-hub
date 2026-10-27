#!/usr/bin/env node
/**
 * Scan renderer/src modules and test coverage hints.
 * Usage: node ~/.cursor/skills/test-behavior-sync/scripts/scan-modules.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename, extname, dirname } from 'node:path'
import { execSync } from 'node:child_process'

const cwd = process.cwd()

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const pkg = readJson(join(cwd, 'package.json')) || {}
const deps = { ...pkg.dependencies, ...pkg.devDependencies }
let rendererPath = 'src'
if (deps['electron-vite'] || deps.electron) rendererPath = 'src/renderer/src'
else if (deps.vite) rendererPath = 'src'

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules') continue
      walk(full, acc)
    } else if (/\.(tsx?|jsx?)$/.test(name) && !/\.(test|spec)\.(tsx?|jsx?)$/.test(name) && !/\.d\.ts$/.test(name)) {
      acc.push(relative(cwd, full).replace(/\\/g, '/'))
    }
  }
  return acc
}

const skipPattern =
  /main\.tsx$|env\.d\.ts$|global\.d\.ts$|types\/index\.ts$|todoTypes\.ts$|TodoListContext\.tsx$/

const sourceFiles = walk(join(cwd, rendererPath)).filter((f) => !skipPattern.test(f))

function moduleName(file) {
  return basename(file, extname(file))
}

function hasTestFile(file) {
  const ext = extname(file)
  const noExt = file.slice(0, -ext.length)
  const paths = [`${noExt}.test.ts`, `${noExt}.test.tsx`, `${noExt}.spec.ts`, `${noExt}.spec.tsx`]
  return paths.some((p) => existsSync(join(cwd, p)))
}

let changedFiles = []
try {
  changedFiles = execSync('git diff --name-only HEAD', { cwd, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((f) => f.replace(/\\/g, '/'))
} catch {
  /* no git */
}

const manifest = readJson(join(cwd, 'tests/manifest.json'))
const manifestModules = manifest?.modules ? Object.keys(manifest.modules) : []

const modules = sourceFiles.map((file) => {
  const name = moduleName(file)
  const inManifest = manifestModules.includes(name)
  const tested = hasTestFile(file) || inManifest
  const changed = changedFiles.some((c) => c.includes(file) || c.includes(name))
  let tier = 'P1'
  if (/Reducer|\/utils\/|\/hooks\//.test(file)) tier = 'P0'
  if (/App\.tsx|ApplicationLayout|ContextProvider/.test(file)) tier = 'P2'
  return { name, file, tier, tested, changed, inManifest }
})

const uncovered = modules.filter((m) => !m.tested)
const changedModules = modules.filter((m) => m.changed)

console.log(
  JSON.stringify(
    {
      rendererPath,
      total: modules.length,
      uncoveredCount: uncovered.length,
      changedModuleCount: changedModules.length,
      modules,
      uncovered: uncovered.map((m) => m.name),
      changedModules: changedModules.map((m) => m.name),
      suggestScope: changedModules.length > 0 ? 'commit' : 'full',
    },
    null,
    2,
  ),
)

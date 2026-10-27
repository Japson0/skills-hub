#!/usr/bin/env node
/**
 * Run Vitest and write testHistory reports. Does NOT modify source code.
 * Usage: node ~/.cursor/skills/test-run/scripts/run-test-report.mjs
 * Env: TEST_RUN_TRIGGER=manual|scheduled|ci
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  formatFailureMarkdown,
  loadCatalog,
  loadManifest,
  loadTestCatalogMap,
  suggestNextFromTriage,
  triageFailure,
} from './triage-failures.mjs'

const cwd = process.cwd()
const trigger = process.env.TEST_RUN_TRIGGER || 'manual'

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function timestampDir() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
}

function fingerprint(file, name, err) {
  const raw = `${file}|${name}|${(err || '').split('\n')[0]}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 12)
}

function moduleFromPath(file) {
  if (!file) return 'unknown'
  const norm = file.replace(/\\/g, '/')
  const m = norm.match(/src\/(?:renderer\/src\/)?(.+?)(?:\.(?:test|spec))?[./]/)
  if (m) return m[1].split('/')[0]
  const base = norm.split('/').pop() || norm
  return base.replace(/\.(test|spec)\.(tsx?|jsx?)$/, '')
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true })
}

// --- preflight ---
const pkg = readJson(join(cwd, 'package.json'), {})
const hasVitest = !!(pkg.devDependencies?.vitest || pkg.dependencies?.vitest)
const testCmd = pkg.scripts?.test ? 'npm test' : hasVitest ? 'npx vitest run' : null

if (!testCmd) {
  console.error(JSON.stringify({ ok: false, error: 'NO_VITEST', message: 'Run /test-generate first to set up Vitest.' }))
  process.exit(2)
}

const ts = timestampDir()
const historyRoot = join(cwd, 'testHistory')
const runDir = join(historyRoot, ts)
ensureDir(runDir)
ensureDir(join(cwd, '.cursor'))

const jsonOut = join(runDir, 'vitest-output.json')

// vitest json reporter via CLI
const vitestArgs = pkg.scripts?.test
  ? null
  : ['vitest', 'run', '--reporter=json', `--outputFile=${jsonOut}`]

let exitCode = 1
let vitestResult = null

if (vitestArgs) {
  const r = spawnSync('npx', vitestArgs, { cwd, encoding: 'utf8', shell: true })
  exitCode = r.status ?? 1
  if (existsSync(jsonOut)) vitestResult = readJson(jsonOut)
} else {
  // npm test — try with vitest json flags appended
  const r = spawnSync('npm', ['test', '--', '--reporter=json', `--outputFile=${jsonOut}`], {
    cwd,
    encoding: 'utf8',
    shell: true,
  })
  exitCode = r.status ?? 1
  if (existsSync(jsonOut)) {
    vitestResult = readJson(jsonOut)
  } else {
    // fallback: capture stdout/stderr
    writeFileSync(join(runDir, 'vitest-stdout.txt'), (r.stdout || '') + (r.stderr || ''))
  }
}

// Parse vitest JSON (v1/v2 shapes)
function parseVitestJson(data) {
  const passed = []
  const failed = []
  const skipped = []

  if (!data) return { passed, failed, skipped }

  const files = data.testResults || data.files || []
  for (const file of files) {
    const filePath = file.name || file.filePath || file.file || ''
    const tests = file.assertionResults || file.tasks || file.tests || []
    for (const t of tests) {
      const name = t.fullName || t.name || t.title || 'unnamed'
      const status = t.status || t.state
      const entry = {
        file: filePath,
        name,
        module: moduleFromPath(filePath),
        error: t.failureMessages?.join('\n') || t.error?.message || t.message || '',
      }
      if (status === 'passed') passed.push(entry)
      else if (status === 'failed' || status === 'fail') failed.push(entry)
      else if (status === 'skipped' || status === 'skip' || status === 'pending') skipped.push(entry)
    }
  }

  // vitest 2 top-level counts fallback
  if (passed.length === 0 && failed.length === 0 && data.numPassedTests != null) {
    return {
      passed: Array(data.numPassedTests).fill({ name: '(aggregated)', module: '—' }),
      failed: Array(data.numFailedTests || 0).fill({ name: '(see vitest-output.json)', module: '—' }),
      skipped: Array(data.numPendingTests || 0).fill({ name: '(skipped)', module: '—' }),
    }
  }

  return { passed, failed, skipped }
}

const { passed, failed, skipped } = parseVitestJson(vitestResult)
const status = failed.length === 0 && exitCode === 0 ? 'pass' : 'fail'
const statusEmoji = status === 'pass' ? '✅' : '❌'
const runAt = new Date().toISOString()
const gitSha = git('rev-parse --short HEAD')
const gitBranch = git('rev-parse --abbrev-ref HEAD')

// Group by module
const byModule = {}
for (const f of failed) {
  byModule[f.module] = byModule[f.module] || { failed: [], passed: [] }
  byModule[f.module].failed.push(f)
}
for (const p of passed) {
  byModule[p.module] = byModule[p.module] || { failed: [], passed: [] }
  byModule[p.module].passed.push(p)
}

const catalog = loadCatalog(cwd)
const testCatalogMap = loadTestCatalogMap(cwd)
const manifest = loadManifest(cwd)

function triageAll(failureList) {
  return failureList.map((f) => {
    const fp = fingerprint(f.file, f.name, f.error)
    const result = triageFailure(f, {
      catalog,
      testCatalogMap,
      manifest,
      fingerprint: fp,
    })
    return { failure: f, fingerprint: fp, ...result }
  })
}

const triagedFailures = triageAll(failed)

// summary.md
let summary = `# Test Run ${runAt}\n\n`
summary += `## 概览\n\n`
summary += `- Vitest: ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped\n`
summary += `- 触发: ${trigger}\n`
summary += `- Git: ${gitSha || 'n/a'} (${gitBranch || 'n/a'})\n`
summary += `- Exit code: ${exitCode}\n\n`

const modules = [...new Set([...Object.keys(byModule)])].sort()
for (const mod of modules) {
  const { passed: mp, failed: mf } = byModule[mod]
  summary += `## ${mod}\n\n`
  summary += `### ✅ 通过 (${mp.length})\n\n`
  if (mp.length === 0) summary += `- （无）\n\n`
  else mp.slice(0, 50).forEach((t) => { summary += `- ${t.name}\n` })
  if (mp.length > 50) summary += `- ... 另有 ${mp.length - 50} 项\n`
  summary += `\n### ❌ 未通过 (${mf.length})\n\n`
  if (mf.length === 0) summary += `- （无）\n\n`
  else {
    for (const t of mf) {
      const fp = fingerprint(t.file, t.name, t.error)
      const triage = triagedFailures.find((x) => x.fingerprint === fp) || triageFailure(t, {
        catalog,
        testCatalogMap,
        manifest,
        fingerprint: fp,
      })
      summary += formatFailureMarkdown(t, triage, fp, null)
    }
  }
}

summary += `---\n\n## 归档\n\n`
summary += `- [vitest-output.json](./vitest-output.json)\n`
summary += `- [report.json](./report.json)\n`

writeFileSync(join(runDir, 'summary.md'), summary, 'utf8')

const failureRecords = triagedFailures.map((t) => ({
  module: t.failure.module,
  test: t.failure.name,
  file: t.failure.file,
  error: t.failure.error,
  catalogId: t.catalogId,
  sourcePath: t.sourcePath,
  triage: t.category,
  baselineHint: t.baselineHint,
  expectedVsActual: t.expectedVsActual,
  fingerprint: t.fingerprint,
  analysis: null,
  enriched: false,
}))

const reportJson = {
  runAt,
  trigger,
  gitSha,
  gitBranch,
  passed: passed.length,
  failed: failed.length,
  skipped: skipped.length,
  status,
  exitCode,
  failures: failureRecords,
}
writeFileSync(join(runDir, 'report.json'), JSON.stringify(reportJson, null, 2), 'utf8')

// LATEST.md
const failRows = modules
  .filter((m) => byModule[m].failed.length > 0)
  .map((m) => `| ${m} | ${byModule[m].failed.length} | ${byModule[m].failed[0]?.name?.slice(0, 60) || '—'} |`)
  .join('\n')

const latest = `# 测试报告 · ${runAt.replace('T', ' ').slice(0, 19)}

**结果**: ${statusEmoji} ${failed.length} failed · ${passed.length} passed · ${skipped.length} skipped
**触发**: ${trigger}
**Commit**: ${gitSha || 'n/a'} · 分支 ${gitBranch || 'n/a'}

## 需要关注

${failed.length === 0 ? '无 — 全部通过 🎉' : `| 模块 | 失败 | 说明 |\n|------|------|------|\n${failRows}`}

→ 详细报告: [${ts}/summary.md](./${ts}/summary.md)

## 建议下一步

${suggestNextFromTriage(failed, triagedFailures, false)}

---
*完整历史见 testHistory/ 下各时间戳目录*
`

writeFileSync(join(historyRoot, 'LATEST.md'), latest, 'utf8')
writeFileSync(
  join(historyRoot, 'latest.json'),
  JSON.stringify({ runAt, detailDir: `testHistory/${ts}`, status }, null, 2),
  'utf8'
)

const lastRun = {
  runAt,
  trigger,
  gitSha,
  gitBranch,
  passed: passed.length,
  failed: failed.length,
  skipped: skipped.length,
  status,
  latestMarkdown: 'testHistory/LATEST.md',
  latestDetail: `testHistory/${ts}/summary.md`,
  failures: failureRecords,
}
writeFileSync(join(cwd, '.cursor/test-last-run.json'), JSON.stringify(lastRun, null, 2), 'utf8')

console.log(
  JSON.stringify({
    ok: true,
    status,
    passed: passed.length,
    failed: failed.length,
    latest: 'testHistory/LATEST.md',
    detail: `testHistory/${ts}/summary.md`,
  })
)

process.exit(status === 'pass' ? 0 : 1)

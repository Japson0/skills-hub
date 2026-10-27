#!/usr/bin/env node
/**
 * Triage test failures using behavior-catalog, manifest, test file comments, and error patterns.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'

/** @typedef {{ id: string, scenario: string, expected: string, source: string, status: string, module: string }} CatalogEntry */
/** @typedef {{ triage: string, suggestion: string, catalogId: string|null, expectedVsActual: string|null, category: string, sourcePath: string|null, analysis: object|null }} TriageResult */
/** @typedef {{ possibleCauses?: string[], rootCause?: string, codeRefs?: string[], fixDirection?: string, fixSuggestion?: string, risk?: string, nextStep?: string }} FailureAnalysis */

const CATALOG_ID_RE = /\b([A-Z]+-\d+)\b/

export function loadCatalog(cwd) {
  const path = join(cwd, 'tests/behavior-catalog.md')
  if (!existsSync(path)) return { entries: {}, byModule: {} }

  const content = readFileSync(path, 'utf8')
  /** @type {Record<string, CatalogEntry>} */
  const entries = {}
  /** @type {Record<string, CatalogEntry[]>} */
  const byModule = {}

  let currentModule = ''
  for (const line of content.split('\n')) {
    const mod = line.match(/^##\s+.+(?:（(\w+)）|\((\w+)\))/)
    if (mod) currentModule = mod[1] || mod[2] || ''

    const row = line.match(
      /^\|\s*([A-Z]+-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\w+)\s*\|/
    )
    if (!row) continue

    const entry = {
      id: row[1].trim(),
      scenario: row[2].trim(),
      expected: row[3].trim(),
      source: row[4].trim(),
      status: row[5].trim(),
      module: currentModule,
    }
    entries[entry.id] = entry
    byModule[currentModule] = byModule[currentModule] || []
    byModule[currentModule].push(entry)
  }

  return { entries, byModule }
}

export function loadManifest(cwd) {
  const path = join(cwd, 'tests/manifest.json')
  if (!existsSync(path)) return { byTestFile: {}, byModule: {} }

  const data = JSON.parse(readFileSync(path, 'utf8'))
  /** @type {Record<string, { module: string, source: string, catalogIds: string[] }>} */
  const byTestFile = {}
  /** @type {Record<string, { source: string, testFile: string }>} */
  const byModule = {}

  for (const [module, info] of Object.entries(data.modules || {})) {
    const testFile = (info.file || '').replace(/\\/g, '/')
    const source = info.source || ''
    byTestFile[testFile] = { module, source, catalogIds: info.catalogIds || [] }
    byModule[module.toLowerCase()] = { source, testFile }
    const kebab = basename(testFile).replace(/\.(test|spec)\.(tsx?|jsx?)$/, '')
    byModule[kebab.toLowerCase()] = { source, testFile, moduleName: module }
  }

  return { byTestFile, byModule }
}

/**
 * Map "it('...')" test title -> catalog ID via preceding // catalog: XX-xx comment.
 */
export function loadTestCatalogMap(cwd) {
  const dir = join(cwd, 'tests/unit')
  if (!existsSync(dir)) return {}

  /** @type {Record<string, Record<string, string>>} file -> testName -> catalogId */
  const map = {}

  for (const file of readdirSync(dir).filter((f) => /\.(test|spec)\.(tsx?|jsx?)$/.test(f))) {
    const filePath = join(dir, file)
    const content = readFileSync(filePath, 'utf8')
    const rel = `tests/unit/${file}`
    map[rel] = map[rel] || {}

    const itRe = /it\s*\(\s*['"`]([^'"`]+)['"`]/g
    let match
    while ((match = itRe.exec(content)) !== null) {
      const testName = match[1]
      const before = content.slice(Math.max(0, match.index - 200), match.index)
      const after = content.slice(match.index, match.index + 400)
      const catalogMatch =
        after.match(/\/\/\s*catalog:\s*([A-Z]+-\d+)/i) ||
        before.match(/\/\/\s*catalog:\s*([A-Z]+-\d+)/i)
      if (catalogMatch) map[rel][testName] = catalogMatch[1]
    }
  }

  return map
}

function normPath(p) {
  return (p || '').replace(/\\/g, '/')
}

function resolveSourcePath(failure, manifest) {
  const file = normPath(failure.file)
  for (const [testFile, info] of Object.entries(manifest.byTestFile || {})) {
    if (file.endsWith(testFile) || file.includes(testFile)) return info.source
  }
  const mod = (failure.module || '').toLowerCase()
  if (manifest.byModule?.[mod]?.source) return manifest.byModule[mod].source
  return null
}

function findCatalogIdInTests(tests, failureName) {
  if (!tests || !failureName) return null
  if (tests[failureName]) return tests[failureName]

  for (const [testName, catalogId] of Object.entries(tests)) {
    if (failureName === testName || failureName.endsWith(testName)) return catalogId
    if (failureName.includes(testName) || testName.includes(failureName)) return catalogId
  }

  const stripped = failureName.replace(/^[\w-]+\s+@\w+\s+/, '')
  if (tests[stripped]) return tests[stripped]
  for (const [testName, catalogId] of Object.entries(tests)) {
    if (stripped === testName || stripped.endsWith(testName) || testName.endsWith(stripped)) {
      return catalogId
    }
  }

  return null
}

function resolveCatalogId(failure, testCatalogMap) {
  const file = normPath(failure.file)
  const shortFile = file.includes('tests/unit/') ? file.slice(file.indexOf('tests/unit/')) : basename(file)

  for (const [mapFile, tests] of Object.entries(testCatalogMap)) {
    if (file.endsWith(mapFile) || shortFile === mapFile || file.includes(mapFile)) {
      const id = findCatalogIdInTests(tests, failure.name)
      if (id) return id
    }
  }

  const idInName = failure.name.match(CATALOG_ID_RE)
  return idInName ? idInName[1] : null
}

function parseAssertionError(error) {
  const firstLine = (error || '').split('\n')[0] || ''
  const blob = (error || '').slice(0, 800)

  let m = firstLine.match(/expected '([^']*)' to be '([^']*)'/i)
  if (m) return { actual: m[1], expected: m[2], summary: `实际「${m[1]}」，预期「${m[2]}」` }

  m = firstLine.match(/expected (true|false) to be (true|false)/i)
  if (m) {
    const label = (v) => (v === 'true' ? '真/可见' : '假/不可见')
    return { actual: m[1], expected: m[2], summary: `实际 ${label(m[1])}，预期 ${label(m[2])}` }
  }

  m = blob.match(/expected (\[[\s\S]*?\]) to deeply equal (\[[\s\S]*?\])/i)
  if (m) {
    const actual = m[1].replace(/\s+/g, ' ').trim()
    const expected = m[2].replace(/\s+/g, ' ').trim()
    return { actual, expected, summary: `实际 ${actual.slice(0, 120)}，预期 ${expected.slice(0, 120)}` }
  }

  m = firstLine.match(/expected .* to have a length of (\d+) but got \+?(-?\d+)/i)
  if (m) return { actual: m[2], expected: m[1], summary: `实际 ${m[2]} 项，预期 ${m[1]} 项` }

  m = firstLine.match(/expected \[([^\]]*)\] to include '([^']*)'/i)
  if (m) return { actual: `[${m[1]}]`, expected: m[2], summary: `实际 class/状态 [${m[1].trim()}]，预期含「${m[2]}」` }

  m = firstLine.match(/expected \[([^\]]*)\] to not include '([^']*)'/i)
  if (m) return { actual: `[${m[1]}]`, expected: `不含 ${m[2]}`, summary: `实际 [${m[1].trim()}]，预期不含「${m[2]}」` }

  m = firstLine.match(/expected .* to be called with arguments: (.+)/i)
  if (m) {
    return {
      actual: '未被调用或参数不符',
      expected: m[1].trim(),
      summary: `预期调用参数 ${m[1].trim()}，实际未调用或参数不符`,
    }
  }

  m = blob.match(/Number of calls:\s*(\d+)/i)
  if (m && /scrollTo|toHaveBeenCalled/i.test(blob)) {
    return {
      actual: `调用 ${m[1]} 次`,
      expected: '至少调用 1 次且参数正确',
      summary: `实际调用 ${m[1]} 次，预期至少 1 次且参数正确`,
    }
  }

  return null
}

function classifyCategory(failure, catalogEntry, catalogId) {
  const blob = `${failure.name} ${failure.error}`.toLowerCase()

  if (/@draft\b/i.test(failure.name)) {
    return 'Draft-Unconfirmed'
  }

  if (catalogEntry?.status === 'draft') {
    if (/assertionerror/i.test(failure.error) && catalogEntry.expected) {
      return 'Logic-Bug'
    }
    return 'Draft-Unconfirmed'
  }

  if (
    /cannot find module|failed to resolve import|could not locate module|module not found/i.test(
      failure.error
    )
  ) {
    if (/tests[/\\]unit|\.test\.|\.spec\./i.test(failure.file)) return 'Trivial-Test'
    return 'Trivial-Prod'
  }

  if (/is not defined|referenceerror|syntaxerror.*test/i.test(blob)) {
    return 'Trivial-Test'
  }

  const integrationIds = new Set(['TR-06', 'TR-07'])
  const isAsyncModule = /async-lab|asynclab/i.test(`${failure.module} ${failure.file} ${failure.name}`)
  if (
    integrationIds.has(catalogId || '') ||
    isAsyncModule ||
    /async-loading|flushpromises|loading.*race|竞态/i.test(`${failure.name} ${failure.error}`)
  ) {
    return 'Integration'
  }

  if (/@spec\b/i.test(failure.name) && !/@confirmed\b/i.test(failure.name)) {
    return 'Spec-Drift'
  }

  if (/@confirmed\b/i.test(failure.name) || catalogEntry?.status === 'confirmed') {
    return catalogEntry?.status === 'confirmed' ? 'Spec-Drift' : 'Logic-Bug'
  }

  if (
    /\b(test timed out|timeout of \d+|timed out after|flaky test|intermittent failure)\b/i.test(blob) ||
    (/\bflaky\b/i.test(failure.name) && !/@confirmed\b/i.test(failure.name))
  ) {
    return 'Flaky'
  }

  if (catalogEntry?.status === 'confirmed' || catalogEntry?.source === 'openspec') {
    return catalogEntry.source === 'openspec' ? 'Spec-Drift' : 'Logic-Bug'
  }

  if (/assertionerror/i.test(failure.error)) {
    return 'Logic-Bug'
  }

  return 'Logic-Bug'
}

function buildBaselineHint(category, catalogEntry, catalogId, sourcePath, parsed) {
  const idPart = catalogId ? `${catalogId} · ` : ''
  const src = sourcePath ? `\`${sourcePath}\`` : '被测源文件'
  const eva = parsed?.summary ? parsed.summary : ''
  const catalogExpected = catalogEntry?.expected
    ? `Catalog：${catalogEntry.expected.slice(0, 100)}${catalogEntry.expected.length > 100 ? '…' : ''}`
    : ''

  switch (category) {
    case 'Draft-Unconfirmed':
      return `${idPart}@draft 需求未确认 — 先 /test-behavior-sync 更新 catalog`
    case 'Trivial-Test':
      return `${idPart}测试代码问题 — 检查 ${failureFileHint(sourcePath)} import/mock/断言`
    case 'Trivial-Prod':
      return `${idPart}生产代码明显问题 — 检查 ${src} export/typo`
    case 'Integration':
      return `${idPart}异步/时序 — 重点 ${src} loading、await、竞态`
    case 'Flaky':
      return `${idPart}疑似不稳定 — 检查超时、未 await、共享状态`
    case 'Spec-Drift':
    case 'Logic-Bug':
    default:
      return [idPart + (category === 'Spec-Drift' ? '实现与 @confirmed 不一致' : '业务逻辑与预期不符'), eva, catalogExpected]
        .filter(Boolean)
        .join(' · ')
  }
}

function failureFileHint(sourcePath) {
  return sourcePath ? `\`${sourcePath}\`` : '实现文件'
}

/**
 * Render structured analysis block for summary.md
 * @param {FailureAnalysis|null|undefined} analysis
 */
export function formatAnalysisMarkdown(analysis) {
  if (!analysis) {
    return `##### 代码分析

- **状态**: 待 Agent 静态扫描后 enrich（Write \`.cursor/test-run-enrich.json\` 后运行 enrich-test-report.mjs --file）
`
  }

  const lines = ['##### 代码分析', '']

  if (analysis.possibleCauses?.length) {
    lines.push('- **可能原因**:')
    for (const c of analysis.possibleCauses) lines.push(`  - ${c}`)
  }
  if (analysis.rootCause) lines.push(`- **根因**: ${analysis.rootCause}`)
  if (analysis.codeRefs?.length) {
    lines.push('- **相关代码**:')
    for (const ref of analysis.codeRefs) lines.push(`  - \`${ref}\``)
  }
  if (analysis.fixDirection) lines.push(`- **建议修复方向**: ${analysis.fixDirection}`)
  if (analysis.fixSuggestion) lines.push(`- **修复建议**: ${analysis.fixSuggestion}`)
  if (analysis.risk) lines.push(`- **风险**: ${analysis.risk}`)
  if (analysis.nextStep) lines.push(`- **下一步**: ${analysis.nextStep}`)

  return lines.join('\n') + '\n'
}

/**
 * @param {object} failure
 * @param {object} triage
 * @param {string} fingerprint
 * @param {FailureAnalysis|null|undefined} analysis
 */
export function formatFailureMarkdown(failure, triage, fingerprint, analysis = null) {
  const errSnippet = (failure.error || 'unknown').split('\n').slice(0, 3).join(' ')
  let block = `<!-- failure:${fingerprint} -->\n`
  block += `#### ${failure.name}\n\n`
  block += `- **文件**: \`${failure.file}\`\n`
  if (triage.catalogId) block += `- **Catalog**: ${triage.catalogId}`
  if (triage.catalogEntry?.status === 'confirmed' || /@confirmed\b/i.test(failure.name)) {
    block += ' @confirmed'
  }
  block += `\n`
  if (triage.sourcePath) block += `- **被测源文件**: \`${triage.sourcePath}\`\n`
  if (triage.expectedVsActual) block += `- **预期 vs 实际**: ${triage.expectedVsActual}\n`
  block += `- **Vitest 报错**: ${errSnippet}\n`
  block += `- **判断**: ${triage.triage}\n`
  block += `- **初步线索**: ${triage.baselineHint || triage.suggestion}\n\n`
  block += formatAnalysisMarkdown(analysis)
  block += `<!-- /failure:${fingerprint} -->\n\n`
  return block
}

/**
 * @param {object} failure - { file, name, module, error }
 * @param {object} ctx - { catalog, testCatalogMap, manifest, fingerprint, analysis }
 * @returns {TriageResult}
 */
export function triageFailure(failure, ctx) {
  const catalogId = resolveCatalogId(failure, ctx.testCatalogMap)
  const catalogEntry = catalogId ? ctx.catalog.entries[catalogId] : null
  const sourcePath = resolveSourcePath(failure, ctx.manifest || { byTestFile: {}, byModule: {} })
  const parsed = parseAssertionError(failure.error)
  const category = classifyCategory(failure, catalogEntry, catalogId)

  let expectedVsActual = parsed?.summary || null
  if (catalogEntry?.expected) {
    const catalogPart = `Catalog 预期：${catalogEntry.expected.slice(0, 120)}${catalogEntry.expected.length > 120 ? '…' : ''}`
    expectedVsActual = expectedVsActual ? `${expectedVsActual}；${catalogPart}` : catalogPart
  }

  let triageLabel = category
  if (catalogId) triageLabel = `${category} · ${catalogId}`

  const baselineHint = buildBaselineHint(category, catalogEntry, catalogId, sourcePath, parsed)

  return {
    triage: triageLabel,
    suggestion: baselineHint,
    baselineHint,
    catalogId,
    catalogEntry,
    expectedVsActual,
    category,
    sourcePath,
    parsed,
    analysis: ctx.analysis || null,
  }
}

/**
 * Build LATEST.md「建议下一步」from triage results.
 */
export function suggestNextFromTriage(failed, triageResults, enriched = false) {
  if (failed.length === 0) return '- 全部通过，无需操作。'

  const lines = []
  const counts = {}
  for (const t of triageResults) {
    counts[t.category] = (counts[t.category] || 0) + 1
  }

  if (!enriched && failed.length > 0) {
    lines.push(
      `- ${failed.length} 项失败 → **Agent 须读源码完成静态分析，并写入 summary 的「代码分析」**（见 skill：enrich-test-report.mjs）`
    )
  }

  if (counts['Draft-Unconfirmed']) {
    lines.push(`- ${counts['Draft-Unconfirmed']} 项 @draft → **/test-behavior-sync** 确认需求`)
  }
  if (counts['Trivial-Test'] || counts['Trivial-Prod']) {
    const n = (counts['Trivial-Test'] || 0) + (counts['Trivial-Prod'] || 0)
    lines.push(`- ${n} 项 trivial → 见 summary **代码分析** 中的修复建议，低风险可直接修`)
  }
  if (counts['Integration'] || counts['Logic-Bug'] || counts['Spec-Drift']) {
    const n = (counts['Integration'] || 0) + (counts['Logic-Bug'] || 0) + (counts['Spec-Drift'] || 0)
    const ids = triageResults
      .filter((t) => ['Integration', 'Logic-Bug', 'Spec-Drift'].includes(t.category) && t.catalogId)
      .map((t) => t.catalogId)
      .slice(0, 5)
    const idHint = ids.length ? `（${ids.join('、')}）` : ''
    lines.push(
      `- ${n} 项逻辑/spec 偏差${idHint} → 见 summary **代码分析**；仅静态分析不确定时再 \`/test-debug\``
    )
  }
  if (counts['Flaky']) {
    lines.push(`- ${counts['Flaky']} 项疑似 flaky → 重跑或加 waitFor，勿删断言`)
  }

  if (enriched) {
    lines.push('- 报告已含代码分析 → 可直接按 summary 修复，或 **/test-run-fix**')
  }

  return lines.join('\n')
}

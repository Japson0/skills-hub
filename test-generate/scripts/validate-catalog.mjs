#!/usr/bin/env node
/**
 * Validate tests/behavior-catalog.md structure. Attempts basic fixes if fix=true env.
 * Usage: node ~/.cursor/skills/test-generate/scripts/validate-catalog.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const cwd = process.cwd()
const catalogPath = join(cwd, 'tests/behavior-catalog.md')

const REQUIRED_HEADERS = ['ID', '场景', '预期', '来源', '状态']
const errors = []
const warnings = []
const pendingConfirmation = []
const ids = new Set()

const PENDING_MARKERS = ['待确认', 'TBD', 'TODO:']
function hasPendingMarker(text) {
  return PENDING_MARKERS.some((m) => text.includes(m))
}

if (!existsSync(catalogPath)) {
  console.log(JSON.stringify({ ok: false, errors: ['MISSING_CATALOG'], path: 'tests/behavior-catalog.md' }))
  process.exit(1)
}

let content = readFileSync(catalogPath, 'utf8')
const fixed = process.env.CATALOG_AUTO_FIX === '1'

function parseTableRows(section) {
  const lines = section.split('\n')
  const rows = []
  let header = null
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
    if (cells.every((c) => /^-+$/.test(c.replace(/:/g, '')))) continue
    if (!header) {
      header = cells
      continue
    }
    rows.push({ cells, line })
  }
  return { header, rows }
}

const sections = content.split(/^## /m).slice(1)
if (sections.length === 0) {
  errors.push('NO_MODULE_SECTIONS')
}

for (const sec of sections) {
  const moduleName = sec.split('\n')[0].trim()
  const { header, rows } = parseTableRows(sec)
  if (!header) {
    warnings.push(`模块 ${moduleName} 无表格`)
    continue
  }
  for (const h of REQUIRED_HEADERS) {
    if (!header.includes(h)) errors.push(`模块 ${moduleName} 缺少列: ${h}`)
  }
  for (const { cells } of rows) {
    if (cells.length < 5) {
      errors.push(`模块 ${moduleName} 行格式错误: ${cells.join(' | ')}`)
      continue
    }
    const [id, scenario, expected, source, status] = cells
    if (!/^[A-Z]{2,}-(\d+|BG-\d+)$/.test(id)) warnings.push(`ID 格式建议 XX-01: ${id}`)
    if (ids.has(id)) errors.push(`重复 ID: ${id}`)
    ids.add(id)
    if (hasPendingMarker(scenario) || hasPendingMarker(expected)) {
      pendingConfirmation.push({
        id,
        module: moduleName,
        scenario,
        expected,
        status,
      })
    }
    if (!['draft', 'confirmed', 'spec'].includes(status)) {
      warnings.push(`未知状态 ${status} (${id})`)
    }
    if (!['openspec', 'user', 'code'].includes(source)) {
      warnings.push(`未知来源 ${source} (${id})`)
    }
  }
}

// Basic auto-fix: normalize table separator spacing
if (fixed && errors.length === 0) {
  let next = content.replace(/\|\s+\|/g, '| |')
  if (next !== content) {
    writeFileSync(catalogPath, next, 'utf8')
    warnings.push('AUTO_FIX: normalized table spacing')
  }
}

const ok = errors.length === 0
const blocked = ok && pendingConfirmation.length > 0
console.log(
  JSON.stringify(
    {
      ok,
      blocked,
      path: 'tests/behavior-catalog.md',
      moduleSections: sections.length,
      catalogIds: ids.size,
      pendingConfirmation,
      errors,
      warnings,
    },
    null,
    2,
  ),
)

if (!ok) process.exit(1)
if (blocked) process.exit(2)
process.exit(0)

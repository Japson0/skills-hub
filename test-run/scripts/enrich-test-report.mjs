#!/usr/bin/env node
/**
 * Merge Agent static analysis into testHistory report files.
 * Writes each analysis into the matching <!-- failure:{fingerprint} --> block in summary.md.
 *
 * Preferred (UTF-8 safe, especially Windows):
 *   node enrich-test-report.mjs --file .cursor/test-run-enrich.json
 *
 * Fallback (bash):
 *   node enrich-test-report.mjs <<'EOF'
 *   { "analyses": [...] }
 *   EOF
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  formatFailureMarkdown,
  loadCatalog,
  loadManifest,
  loadTestCatalogMap,
  suggestNextFromTriage,
  triageFailure,
} from './triage-failures.mjs'

const cwd = process.cwd()

function readStdin() {
  return new Promise((resolvePromise) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolvePromise(data))
    if (process.stdin.isTTY) resolvePromise('')
  })
}

function parseArgs(argv) {
  const args = argv.slice(2)
  let filePath = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      filePath = args[i + 1]
      i++
    } else if (!args[i].startsWith('-') && !filePath) {
      filePath = args[i]
    }
  }
  return { filePath }
}

function readInputJson({ filePath }) {
  if (filePath) {
    const abs = resolve(cwd, filePath)
    if (!existsSync(abs)) {
      console.error(JSON.stringify({ ok: false, error: 'NO_FILE', message: abs }))
      process.exit(1)
    }
    return { raw: readFileSync(abs, 'utf8').replace(/^\uFEFF/, ''), filePath: abs }
  }
  return { raw: null, filePath: null }
}

async function main() {
  const { filePath: argFile } = parseArgs(process.argv)
  const { raw: fileRaw, filePath } = readInputJson({ filePath: argFile })
  const stdinRaw = fileRaw == null ? await readStdin() : fileRaw
  const raw = stdinRaw?.trim()
  if (!raw) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'NO_INPUT',
        message:
          'Pass analyses JSON via --file .cursor/test-run-enrich.json (UTF-8) or pipe to stdin on bash',
      })
    )
    process.exit(1)
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: 'INVALID_JSON', message: err.message }))
    process.exit(1)
  }
  const analyses = payload.analyses || []
  if (!analyses.length) {
    console.error(JSON.stringify({ ok: false, error: 'EMPTY', message: 'analyses array is empty' }))
    process.exit(1)
  }

  const lastRunPath = join(cwd, '.cursor/test-last-run.json')
  if (!existsSync(lastRunPath)) {
    console.error(JSON.stringify({ ok: false, error: 'NO_LAST_RUN', message: 'Run run-test-report.mjs first' }))
    process.exit(1)
  }

  const lastRun = JSON.parse(readFileSync(lastRunPath, 'utf8'))
  const detailPath = join(cwd, lastRun.latestDetail || '')
  if (!existsSync(detailPath)) {
    console.error(JSON.stringify({ ok: false, error: 'NO_DETAIL', message: lastRun.latestDetail }))
    process.exit(1)
  }

  const reportPath = join(detailPath.replace(/summary\.md$/, ''), 'report.json')
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null

  const byFp = Object.fromEntries(analyses.map((a) => [a.fingerprint, a]))

  const catalog = loadCatalog(cwd)
  const testCatalogMap = loadTestCatalogMap(cwd)
  const manifest = loadManifest(cwd)

  const enrichedFailures = (lastRun.failures || []).map((f) => {
    const analysis = byFp[f.fingerprint] || null
    return { ...f, analysis, enriched: !!analysis }
  })

  lastRun.failures = enrichedFailures
  lastRun.analysisEnriched = true
  lastRun.analysisEnrichedAt = new Date().toISOString()
  writeFileSync(lastRunPath, JSON.stringify(lastRun, null, 2), 'utf8')

  if (report) {
    report.failures = enrichedFailures
    report.analysisEnriched = true
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  }

  let summary = readFileSync(detailPath, 'utf8')
  let replaced = 0
  for (const a of analyses) {
    const fp = a.fingerprint
    if (!fp) continue
    const f = enrichedFailures.find((row) => row.fingerprint === fp)
    if (!f) {
      console.error(JSON.stringify({ ok: false, error: 'UNKNOWN_FINGERPRINT', fingerprint: fp }))
      process.exit(1)
    }
    const analysis = a
    const failure = {
      file: f.file,
      name: f.test,
      module: f.module,
      error: f.error || '',
    }
    const triage = triageFailure(failure, { catalog, testCatalogMap, manifest, analysis })
    const block = formatFailureMarkdown(failure, triage, fp, analysis)
    const re = new RegExp(`<!-- failure:${fp} -->[\\s\\S]*?<!-- /failure:${fp} -->\\n?`, 'm')
    if (!re.test(summary)) {
      console.error(JSON.stringify({ ok: false, error: 'BLOCK_NOT_FOUND', fingerprint: fp, detail: detailPath }))
      process.exit(1)
    }
    summary = summary.replace(re, block)
    replaced++
  }

  writeFileSync(detailPath, summary, { encoding: 'utf8' })

  if (filePath && /\.cursor[/\\]test-run-enrich/i.test(filePath)) {
    try {
      unlinkSync(filePath)
    } catch {
      /* best-effort cleanup */
    }
  }

  const latestPath = join(cwd, 'testHistory/LATEST.md')
  if (existsSync(latestPath)) {
    const triageResults = enrichedFailures.map((f) => ({
      category: f.triage,
      catalogId: f.catalogId,
    }))
    const next = suggestNextFromTriage(
      enrichedFailures.map((f) => ({ name: f.test })),
      triageResults,
      true
    )
    let latest = readFileSync(latestPath, 'utf8')
    latest = latest.replace(/## 建议下一步\n\n[\s\S]*?\n\n---/, `## 建议下一步\n\n${next}\n\n---`)
    writeFileSync(latestPath, latest, 'utf8')
  }

  console.log(
    JSON.stringify({
      ok: true,
      enriched: replaced,
      detail: lastRun.latestDetail,
      summaryPath: detailPath,
    })
  )
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }))
  process.exit(1)
})

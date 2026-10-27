#!/usr/bin/env node
/**
 * @deprecated Use init-debug.mjs instead.
 * Thin wrapper for backward compatibility.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const catalogId = process.argv[2]
if (!catalogId) {
  console.error(JSON.stringify({ ok: false, error: 'MISSING_CATALOG_ID' }))
  process.exit(1)
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const initDebug = join(scriptDir, 'init-debug.mjs')
const out = spawnSync(process.execPath, [initDebug, '--catalog-id', catalogId], {
  cwd: process.cwd(),
  encoding: 'utf8',
})

process.stdout.write(out.stdout ?? '')
process.stderr.write(out.stderr ?? '')
process.exit(out.status ?? 1)

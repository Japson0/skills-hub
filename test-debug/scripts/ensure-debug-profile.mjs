#!/usr/bin/env node
/**
 * Merge debug section into .cursor/test-profile.json (non-destructive).
 * Usage: node ensure-debug-profile.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const cwd = process.cwd()
const profilePath = join(cwd, '.cursor/test-profile.json')

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

const profile = readJson(profilePath, {})
const debugDefaults = {
  rendererUrl: 'http://localhost:5173',
  mcp: {
    playwright: 'playwright',
  },
  devCommands: {
    default: 'npm run dev',
  },
}

profile.debug = { ...debugDefaults, ...(profile.debug ?? {}) }

mkdirSync(join(cwd, '.cursor'), { recursive: true })
writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n')

console.log(
  JSON.stringify(
    {
      ok: true,
      profilePath: '.cursor/test-profile.json',
      debug: profile.debug,
    },
    null,
    2,
  ),
)

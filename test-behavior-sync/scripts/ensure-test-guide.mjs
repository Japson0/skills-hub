#!/usr/bin/env node
/**
 * Create .test-guide.md from template on first test-behavior-sync run.
 * Usage: node ~/.cursor/skills/test-behavior-sync/scripts/ensure-test-guide.mjs
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const cwd = process.cwd()
const guidePath = join(cwd, '.test-guide.md')
const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const templatePath = join(skillRoot, 'reference/test-guide-template.md')

function readTemplate() {
  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf8')
  }
  return `# 项目测试规范

> 由 test-behavior-sync 创建。请补充语言、命名、auto-fix 边界等约定。

- catalog 与测试描述：中文
- 禁止 it.skip 假绿
`
}

if (existsSync(guidePath)) {
  console.log(JSON.stringify({ ok: true, created: false, path: '.test-guide.md', message: 'already exists' }))
  process.exit(0)
}

const content = readTemplate()
writeFileSync(guidePath, content, 'utf8')

const profilePath = join(cwd, '.cursor/test-profile.json')
if (!existsSync(profilePath)) {
  mkdirSync(join(cwd, '.cursor'), { recursive: true })
  writeFileSync(
    profilePath,
    JSON.stringify(
      {
        initializedBy: 'test-behavior-sync',
        openspec: 'skip',
        debug: { rendererUrl: 'http://localhost:5173' },
      },
      null,
      2,
    ),
    'utf8',
  )
}

console.log(
  JSON.stringify({
    ok: true,
    created: true,
    path: '.test-guide.md',
    message: 'Created .test-guide.md — please review and edit project conventions',
  }),
)

// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, expect, it } from 'vitest'

let root: string

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'website-config-'))
  mkdirSync(path.join(root, 'src/i18n/glossary'), { recursive: true })
  writeFileSync(
    path.join(root, 'src/i18n/glossary/preserve-terms.json'),
    '["ComfyUI"]'
  )
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

function checkConfig() {
  return spawnSync(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      fileURLToPath(new URL('./check-config.ts', import.meta.url))
    ],
    { cwd: root, encoding: 'utf8' }
  )
}

it('allows a locale to have no machine translations yet', () => {
  mkdirSync(path.join(root, 'src/i18n/content'))
  writeFileSync(
    path.join(root, 'src/i18n/content/en.json'),
    '{"nav.home":"Home"}'
  )

  const result = checkConfig()

  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  expect(result.stdout).toContain('config OK')
})

it('rejects a missing English source', () => {
  const result = checkConfig()

  expect(result.status).toBe(1)
  expect(result.stderr).toContain('no content/en.json')
})

// @vitest-environment node
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, expect, it } from 'vitest'

const writer = fileURLToPath(
  new URL('./write-data-japanese.ts', import.meta.url)
)
const original = `export const example = {
  title: { en: 'Hello', ja: 'こんにちは' /* machine */ },
  approved: { en: 'Goodbye', ja: 'さようなら' }
}
`

let root: string
let dataFile: string

beforeEach(({ onTestFinished }) => {
  root = mkdtempSync(path.join(tmpdir(), 'website-data-withdrawal-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(path.join(root, 'src/data'), { recursive: true })
  mkdirSync(path.join(root, 'src/i18n/content'), { recursive: true })
  dataFile = path.join(root, 'src/data/example.ts')
  writeFileSync(dataFile, original)
  writeFileSync(path.join(root, 'src/i18n/content/ja.json'), '{}')
})

it('fails freshness checking when the last machine translation was removed', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', import.meta.resolve('tsx'), writer, '--check'],
    { cwd: root, encoding: 'utf8' }
  )

  expect(result.status).toBe(1)
  expect(`${result.stdout}${result.stderr}`).toContain('1 to withdraw')
  expect(readFileSync(dataFile, 'utf8')).toBe(original)
})

it('withdraws stale machine copy while preserving approved Japanese', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', import.meta.resolve('tsx'), writer],
    { cwd: root, encoding: 'utf8' }
  )

  expect(result.status).toBe(0)
  const written = readFileSync(dataFile, 'utf8')
  expect(written).toContain("en: 'Hello'")
  expect(written).toContain("approved: { en: 'Goodbye', ja: 'さようなら' }")
  expect(written).not.toContain('こんにちは')
  expect(written).not.toContain('/* machine */')
})

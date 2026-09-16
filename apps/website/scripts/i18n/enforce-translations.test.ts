// @vitest-environment node
import { execFileSync } from 'node:child_process'
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
import { expect, it } from 'vitest'

it('publishes valid staged translations and preserves existing copy', ({
  onTestFinished
}) => {
  const root = mkdtempSync(path.join(tmpdir(), 'website-enforce-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  const i18n = path.join(root, 'src', 'i18n')
  const files = [
    {
      file: 'content/en.json',
      value: {
        'nav.home': 'Home',
        greeting: 'Hello {name}',
        credits: 'Buy {count} credits'
      }
    },
    { file: 'content/ja.json', value: { 'nav.home': 'ホーム' } },
    {
      file: 'incoming/ja.json',
      value: { greeting: 'こんにちは {name}', credits: 'クレジットを購入' }
    },
    { file: 'glossary/preserve-terms.json', value: ['ComfyUI'] }
  ]
  for (const { file, value } of files) {
    const target = path.join(i18n, file)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, JSON.stringify(value))
  }

  execFileSync(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      fileURLToPath(new URL('./enforce-translations.ts', import.meta.url))
    ],
    {
      cwd: root,
      env: { ...process.env, WEBSITE_I18N_LOCALE: 'ja' }
    }
  )

  const published: unknown = JSON.parse(
    readFileSync(path.join(i18n, 'content/ja.json'), 'utf8')
  )
  expect(published).toEqual({
    'nav.home': 'ホーム',
    greeting: 'こんにちは {name}'
  })
})

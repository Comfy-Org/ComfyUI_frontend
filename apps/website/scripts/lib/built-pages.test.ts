import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

import { localizedBuildPages } from './built-pages'

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

it('pairs localized pages with their English originals and excludes build internals', () => {
  const dist = mkdtempSync(join(tmpdir(), 'built-pages-'))
  directories.push(dist)
  const pages = {
    'index.html': 'English home',
    'pricing/index.html': 'English pricing',
    'untranslated/index.html': 'English only',
    'ja/index.html': 'Japanese home',
    'zh-CN/pricing/index.html': 'Chinese pricing',
    'ja/orphan/index.html': 'No English original',
    '_internal/index.html': 'Build metadata',
    'ja/_internal/index.html': 'Localized build metadata'
  }
  for (const [file, html] of Object.entries(pages)) {
    const target = join(dist, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, html)
  }
  expect(localizedBuildPages(dist)).toEqual([
    {
      locale: 'zh-CN',
      prefix: 'zh-CN',
      route: 'pricing',
      english: 'English pricing',
      localized: 'Chinese pricing'
    },
    {
      locale: 'ja',
      prefix: 'ja',
      route: '',
      english: 'English home',
      localized: 'Japanese home'
    }
  ])
})

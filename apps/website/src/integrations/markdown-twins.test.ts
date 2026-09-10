import type { AstroIntegrationLogger } from 'astro'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it, onTestFinished, vi } from 'vitest'

import { markdownTwins } from './markdown-twins'

it('preserves listed pages and discovers eligible localized pages after the build', async () => {
  const root = await mkdtemp(join(tmpdir(), 'markdown-build-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const page = (title: string) =>
    `<html><head><title>${title}</title></head><body><main><h1>${title}</h1></main></body></html>`
  await mkdir(join(root, 'zh-CN', 'cli'), { recursive: true })
  await mkdir(join(root, 'ja', 'cli'), { recursive: true })
  await mkdir(join(root, 'redirect'), { recursive: true })
  await mkdir(join(root, 'empty'))
  await writeFile(join(root, 'index.html'), page('Home'))
  await writeFile(join(root, '404.html'), page('Not found'))
  await writeFile(join(root, 'zh-CN/cli/index.html'), page('Chinese CLI'))
  await writeFile(join(root, 'ja/cli/index.html'), page('Unpublished CLI'))
  await writeFile(
    join(root, 'redirect/index.html'),
    '<html><head><meta http-equiv="refresh" content="0;url=/"></head></html>'
  )
  const logger: AstroIntegrationLogger = {
    label: 'test',
    options: { level: 'silent', destination: { write: vi.fn() } },
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    flush: vi.fn(),
    close: vi.fn(),
    fork() {
      return this
    }
  }
  const hook = markdownTwins().hooks['astro:build:done']
  if (!hook) throw new Error('Missing build hook')
  await hook({
    dir: pathToFileURL(`${root}/`),
    pages: [{ pathname: '' }, { pathname: '404' }],
    assets: new Map(),
    logger
  })

  expect(await readFile(join(root, '404.md'), 'utf8')).toContain('# Not found')
  expect(await readFile(join(root, 'zh-CN/cli.md'), 'utf8')).toContain(
    '# Chinese CLI'
  )
  expect(existsSync(join(root, 'redirect.md'))).toBe(false)
  expect(existsSync(join(root, 'ja/cli.md'))).toBe(false)
  const fullText = await readFile(join(root, 'llms-full.txt'), 'utf8')
  expect(fullText.match(/# Home/g)).toHaveLength(1)
  expect(fullText).not.toContain('Chinese CLI')
})

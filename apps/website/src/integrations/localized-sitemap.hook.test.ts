import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { localizedSitemap } from './localized-sitemap'

/**
 * The build hook, against real files.
 *
 * `missingSitemapEntries` is unit-tested on its own; this covers what it cannot
 * — walking the built site, spotting redirect stubs, and rewriting the sitemap
 * in place. It matters because this integration is the only thing putting the
 * 114 localized pages `@astrojs/sitemap` cannot see back into the sitemap, and a
 * silent failure here de-lists them without anything going red.
 *
 * A temp directory rather than a mocked filesystem: the code reads real files,
 * so the test gives it real files.
 */
const ORIGIN = 'https://comfy.org'

const EMPTY_SITEMAP =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  '</urlset>'

const messages: { level: string; text: string }[] = []
const logger = {
  info: (text: string) => messages.push({ level: 'info', text }),
  warn: (text: string) => messages.push({ level: 'warn', text })
}

let root: string

async function page(path: string, html = '<html></html>') {
  const dir = join(root, path)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'index.html'), html, 'utf8')
}

async function run() {
  const hook = localizedSitemap(ORIGIN).hooks['astro:build:done']
  if (!hook) throw new Error('the integration registered no build:done hook')
  await hook({
    dir: pathToFileURL(`${root}/`),
    logger
  } as unknown as Parameters<NonNullable<typeof hook>>[0])
  return readFile(join(root, 'sitemap-0.xml'), 'utf8').catch(() => '')
}

beforeEach(async () => {
  messages.length = 0
  root = await mkdtemp(join(tmpdir(), 'localized-sitemap-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('the localized-sitemap build hook', () => {
  it('adds a built page the sitemap left out', async () => {
    await writeFile(join(root, 'sitemap-0.xml'), EMPTY_SITEMAP, 'utf8')
    await page('zh-CN/customers/example')

    const sitemap = await run()

    expect(sitemap).toContain(`${ORIGIN}/zh-CN/customers/example/`)
    expect(sitemap.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('leaves a page the sitemap already lists alone', async () => {
    const loc = `${ORIGIN}/zh-CN/customers/example/`
    await writeFile(
      join(root, 'sitemap-0.xml'),
      EMPTY_SITEMAP.replace(
        '</urlset>',
        `<url><loc>${loc}</loc></url></urlset>`
      ),
      'utf8'
    )
    await page('zh-CN/customers/example')

    const sitemap = await run()

    expect(sitemap.split(loc).length - 1).toBe(1)
  })

  /**
   * A redirect stub is a page in the filesystem and a bounce to a reader.
   * Listing one asks a crawler to index a page that immediately leaves.
   */
  it('never adds a redirect stub', async () => {
    await writeFile(join(root, 'sitemap-0.xml'), EMPTY_SITEMAP, 'utf8')
    await page(
      'zh-CN/customers/moved',
      '<html><head><meta http-equiv="refresh" content="0;url=/customers/moved/"></head></html>'
    )

    const sitemap = await run()

    expect(sitemap).not.toContain('/zh-CN/customers/moved/')
  })

  it('never adds a page the indexing policy excludes', async () => {
    await writeFile(join(root, 'sitemap-0.xml'), EMPTY_SITEMAP, 'utf8')
    await page('zh-CN/privacy-policy')

    const sitemap = await run()

    expect(sitemap).not.toContain('/zh-CN/privacy-policy/')
  })

  /**
   * Loud rather than silent. A missing sitemap means the run that should have
   * produced it failed, and quietly writing nothing would hide that.
   */
  it('warns and stops when there is no sitemap to complete', async () => {
    await page('zh-CN/customers/example')

    await run()

    expect(messages.some((m) => m.level === 'warn')).toBe(true)
  })

  it('says so when the sitemap already lists everything', async () => {
    await writeFile(join(root, 'sitemap-0.xml'), EMPTY_SITEMAP, 'utf8')

    await run()

    expect(
      messages.some((m) => m.level === 'info' && m.text.includes('already'))
    ).toBe(true)
  })
})

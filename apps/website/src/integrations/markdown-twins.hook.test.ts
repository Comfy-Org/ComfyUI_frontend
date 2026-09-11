import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { markdownTwins } from './markdown-twins'

/**
 * The build hook, against real files.
 *
 * `writeMarkdownTwins` is unit-tested on its own; this covers what it cannot —
 * walking the built site and deciding what reaches the section indexes and
 * `llms-full.txt`. Those two are the only places a reader or a model sees the
 * whole corpus, so a page dropping out of them is invisible: the page still
 * exists, it simply stops being discoverable.
 *
 * A temp directory rather than a mocked filesystem: the code reads real files,
 * so the test gives it real files.
 */
const messages: string[] = []
const logger = {
  info: (text: string) => messages.push(text),
  warn: (text: string) => messages.push(text)
}

let root: string

async function page(path: string, html: string) {
  const dir = join(root, path)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'index.html'), html, 'utf8')
}

async function run(pages: { pathname: string }[] = []) {
  const hook = markdownTwins().hooks['astro:build:done']
  if (!hook) throw new Error('the integration registered no build:done hook')
  await hook({
    dir: pathToFileURL(`${root}/`),
    pages,
    logger
  } as unknown as Parameters<NonNullable<typeof hook>>[0])
}

const article = (title: string, body: string) =>
  `<html><head><title>${title}</title></head>` +
  `<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`

beforeEach(async () => {
  messages.length = 0
  root = await mkdtemp(join(tmpdir(), 'markdown-twins-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('the markdown-twins build hook', () => {
  it('writes a twin beside each built page', async () => {
    await page('about', article('About Comfy', 'Who we are.'))

    await run()

    expect(await readFile(join(root, 'about.md'), 'utf8')).toContain(
      'Who we are.'
    )
  })

  it.for(['zh-CN/enterprise', 'zh-CN/enterprise/managed-builds'])(
    'publishes the translated sales page %s as Markdown',
    async (path) => {
      const body = '治理每个团队、每个运行环境中的 ComfyUI。'
      await page(path, article('Comfy Enterprise', body))

      await run()

      const twin = await readFile(join(root, `${path}.md`), 'utf8')
      expect(twin).toContain(body)
      expect(twin).toContain(`canonical: https://comfy.org/${path}`)
    }
  )

  /**
   * The regression this exists for. A twin a page endpoint already wrote is
   * reported as `existing`, not `written`, and the indexes are built from both.
   * Building them from `written` alone would quietly drop every pre-existing
   * twin out of `llms-full.txt` — the corpus shrinks, no page 404s, and nothing
   * goes red.
   */
  it('counts a twin that already exists, not just the ones it wrote', async () => {
    await page('about', article('About Comfy', 'Who we are.'))
    await page('pricing', article('Pricing', 'What it costs.'))
    // Already on disk before the hook runs, as a page endpoint would leave it.
    await writeFile(join(root, 'pricing.md'), '# Pricing\n\nWhat it costs.\n')

    await run()

    const full = await readFile(join(root, 'llms-full.txt'), 'utf8')
    expect(full).toContain('Who we are.')
    expect(full).toContain('What it costs.')
  })

  /**
   * `404.html` sits beside `index.html` rather than in a directory of its own,
   * so the walk that looks for `index.html` cannot see it and it went without a
   * twin. Astro's own page list has it, which is why the two are unioned.
   */
  it('twins a page emitted as a flat file, which the disk walk cannot see', async () => {
    await page('about', article('About Comfy', 'Who we are.'))
    await writeFile(
      join(root, '404.html'),
      article('Not found', 'No such page.'),
      'utf8'
    )

    await run([{ pathname: '404' }])

    expect(await readFile(join(root, '404.md'), 'utf8')).toContain(
      'No such page.'
    )
  })

  /**
   * The reason the fix unions Astro's list rather than twinning every flat
   * `.html` on disk: a search-engine verification file is real HTML in the
   * output and is not a page. Astro never lists it, so it gets no twin.
   */
  it('leaves a public asset alone, since it is not a page', async () => {
    await page('about', article('About Comfy', 'Who we are.'))
    await writeFile(
      join(root, 'baidu_verify_codeva-SdpTW0h62C.html'),
      '<html><body>verification</body></html>',
      'utf8'
    )

    await run([])

    expect(existsSync(join(root, 'baidu_verify_codeva-SdpTW0h62C.md'))).toBe(
      false
    )
  })

  it('reports what it did, so a silent drop to zero is visible', async () => {
    await page('about', article('About Comfy', 'Who we are.'))

    await run()

    expect(messages.join(' ')).toMatch(/wrote \d+ markdown twins/)
  })
})

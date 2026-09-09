import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { writeFullText, writeSectionIndexes } from './section-index'

function twin(
  title: string,
  description: string,
  body: string,
  canonical = 'https://comfy.org/x/'
) {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\ncanonical: ${canonical}\nlang: en\nindex: https://comfy.org/llms.txt\n---\n\n${body}\n`
}

async function seed() {
  const root = await mkdtemp(join(tmpdir(), 'index-'))
  await mkdir(join(root, 'learning', 'vfx'), { recursive: true })
  await mkdir(join(root, 'zh-CN'), { recursive: true })
  await mkdir(join(root, 'ja'), { recursive: true })
  await writeFile(
    join(root, 'index.md'),
    twin('Comfy', 'Home.', '# Comfy\n\nHome body.', 'https://comfy.org/')
  )
  await writeFile(
    join(root, 'learning.md'),
    twin('Learning - Comfy', 'Tutorials by discipline.', '# Learning')
  )
  await writeFile(
    join(root, 'learning', 'vfx.md'),
    twin('VFX Tutorials', 'Clean plates and more.', '# VFX')
  )
  await writeFile(
    join(root, 'learning', 'vfx', 'sky-replacement.md'),
    twin(
      'Sky Replacement',
      '',
      '# Sky Replacement\n\nSteps.',
      'https://comfy.org/learning/vfx/sky-replacement/'
    )
  )
  await writeFile(join(root, 'cli.md'), twin('Comfy CLI', 'The CLI.', '# CLI'))
  await writeFile(
    join(root, 'zh-CN', 'cli.md'),
    twin('Comfy CLI 中文', 'CLI.', '# CLI 中文')
  )
  await writeFile(
    join(root, 'ja', 'cli.md'),
    twin('Comfy CLI 日本語', 'CLI.', '# CLI 日本語')
  )
  // A locale's HOME page twin is `/zh-CN.md`, not `/zh-CN/index.md`, so it does
  // not sit under the locale directory and a prefix+slash test never sees it.
  await writeFile(
    join(root, 'zh-CN.md'),
    twin('Comfy 首页', 'Home.', '# Comfy 首页')
  )
  await writeFile(
    join(root, 'ja.md'),
    twin('Comfy ホーム', 'Home.', '# Comfy ホーム')
  )
  await writeFile(join(root, '404.md'), twin('Not found', '', '# 404'))
  return root
}

const twins = [
  '/index.md',
  '/learning.md',
  '/learning/vfx.md',
  '/learning/vfx/sky-replacement.md',
  '/cli.md',
  '/zh-CN/cli.md',
  '/ja/cli.md',
  '/zh-CN.md',
  '/ja.md',
  '/404.md'
]

describe('writeSectionIndexes', () => {
  it('writes one llms.txt per section with the section page first', async () => {
    const root = await seed()
    const written = await writeSectionIndexes(root, twins, [
      { prefix: '/learning', title: 'Learning', summary: 'Tutorials.' },
      { prefix: '/events', title: 'Events', summary: 'Nothing built here.' }
    ])

    expect(written).toEqual(['/learning/llms.txt'])
    const index = await readFile(join(root, 'learning', 'llms.txt'), 'utf8')
    expect(index.startsWith('# Comfy: Learning\n\n> Tutorials.\n')).toBe(true)
    expect(index).toContain('https://comfy.org/llms.txt')
    const links = index.split('\n').filter((line) => line.startsWith('- ['))
    expect(links).toEqual([
      '- [Learning - Comfy](https://comfy.org/learning.md): Tutorials by discipline.',
      '- [VFX Tutorials](https://comfy.org/learning/vfx.md): Clean plates and more.',
      '- [Sky Replacement](https://comfy.org/learning/vfx/sky-replacement.md): Sky Replacement'
    ])
  })
})

describe('writeFullText', () => {
  it('concatenates the English twins, home first, without the 404 or locale twins', async () => {
    const root = await seed()
    const target = await writeFullText(root, twins)

    expect(target).toBe('/llms-full.txt')
    const full = await readFile(join(root, 'llms-full.txt'), 'utf8')
    expect(full.startsWith('# Comfy: full site text\n\n> ')).toBe(true)
    const sources = full.match(/<!-- https:\/\/comfy\.org[^ ]* -->/g)
    expect(sources).toEqual([
      '<!-- https://comfy.org/ -->',
      '<!-- https://comfy.org/x/ -->',
      '<!-- https://comfy.org/x/ -->',
      '<!-- https://comfy.org/x/ -->',
      '<!-- https://comfy.org/learning/vfx/sky-replacement/ -->'
    ])
    expect(full).toContain('# Comfy\n\n> Home.\n\nHome body.')
    expect(full).toContain('# Sky Replacement\n\nSteps.')
    expect(full).not.toContain('CLI 中文')
    // Every locale, not just Chinese. The filter named only /zh-CN/, so once
    // /ja/ existed its pages leaked into what is meant to be the English corpus.
    expect(full).not.toContain('CLI 日本語')
    // And every locale's HOME page, whose twin is /zh-CN.md rather than
    // /zh-CN/index.md. Both of these were shipping inside llms-full.txt.
    expect(full).not.toContain('Comfy 首页')
    expect(full).not.toContain('Comfy ホーム')
    expect(full).not.toContain('# 404')
  })

  it('leaves the supported-models directory to its own catalog', async () => {
    const root = await seed()
    await mkdir(join(root, 'p', 'supported-models'), { recursive: true })
    await writeFile(
      join(root, 'p', 'supported-models.md'),
      twin('Supported Models', 'Directory.', '# Supported Models')
    )
    await writeFile(
      join(root, 'p', 'supported-models', 'flux.md'),
      twin('Flux in ComfyUI', 'Model.', '# Flux in ComfyUI')
    )

    await writeFullText(root, [
      ...twins,
      '/p/supported-models.md',
      '/p/supported-models/flux.md'
    ])

    const full = await readFile(join(root, 'llms-full.txt'), 'utf8')
    expect(full).not.toContain('Flux in ComfyUI')
    expect(full).not.toContain('# Supported Models')
  })
})

describe('twins with missing or malformed front matter', () => {
  it('falls back to the path for the title and the page URL for canonical', async () => {
    const root = await mkdtemp(join(tmpdir(), 'index-'))
    await mkdir(join(root, 'events'), { recursive: true })
    await writeFile(join(root, 'events.md'), '# Events\n\nNo front matter.\n')
    await writeFile(
      join(root, 'events', 'meetup.md'),
      '---\ntitle: "Unterminated\ndescription: "Also "quoted" oddly"\ncanonical: https://comfy.org/events/meetup/\n---\n\n# Meetup\n'
    )

    await writeSectionIndexes(
      root,
      ['/events.md', '/events/meetup.md'],
      [{ prefix: '/events', title: 'Events', summary: 'Meetups.' }]
    )
    await writeFullText(root, ['/events.md', '/events/meetup.md'])

    const index = await readFile(join(root, 'events', 'llms.txt'), 'utf8')
    expect(index).toContain('- [/events](https://comfy.org/events.md): /events')
    expect(index).toContain(
      '- [Unterminated](https://comfy.org/events/meetup.md): Also "quoted" oddly'
    )
    const full = await readFile(join(root, 'llms-full.txt'), 'utf8')
    expect(full).toContain('<!-- https://comfy.org/events/ -->\n# /events')
    expect(full).toContain(
      '<!-- https://comfy.org/events/meetup/ -->\n# Unterminated'
    )
  })
})

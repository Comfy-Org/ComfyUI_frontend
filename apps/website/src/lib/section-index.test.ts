import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { writeFullText, writeSectionIndexes } from './section-index'

function twin(title: string, description: string, body: string) {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\ncanonical: https://comfy.org/x/\nlang: en\nindex: https://comfy.org/llms.txt\n---\n\n${body}\n`
}

async function seed() {
  const root = await mkdtemp(join(tmpdir(), 'index-'))
  await mkdir(join(root, 'learning', 'vfx'), { recursive: true })
  await mkdir(join(root, 'zh-CN'), { recursive: true })
  await writeFile(
    join(root, 'index.md'),
    twin('Comfy', 'Home.', '# Comfy\n\nHome body.')
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
    twin('Sky Replacement', '', '# Sky Replacement\n\nSteps.')
  )
  await writeFile(join(root, 'cli.md'), twin('Comfy CLI', 'The CLI.', '# CLI'))
  await writeFile(
    join(root, 'zh-CN', 'cli.md'),
    twin('Comfy CLI 中文', 'CLI.', '# CLI 中文')
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
      '<!-- https://comfy.org/index.md -->',
      '<!-- https://comfy.org/cli.md -->',
      '<!-- https://comfy.org/learning.md -->',
      '<!-- https://comfy.org/learning/vfx.md -->',
      '<!-- https://comfy.org/learning/vfx/sky-replacement.md -->'
    ])
    expect(full).toContain('# Comfy\n\n> Home.\n\nHome body.')
    expect(full).toContain('# Sky Replacement\n\nSteps.')
    expect(full).not.toContain('CLI 中文')
    expect(full).not.toContain('# 404')
  })
})

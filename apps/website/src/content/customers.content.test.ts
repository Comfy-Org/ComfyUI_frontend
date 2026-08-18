import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const customersDir = join(dirname(fileURLToPath(import.meta.url)), 'customers')
const locales = ['en', 'zh-CN'] as const

interface Story {
  file: string
  frontmatter: string
  body: string
}

function loadStories(): Story[] {
  const stories: Story[] = []
  for (const locale of locales) {
    const dir = join(customersDir, locale)
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.mdx')) continue
      const raw = readFileSync(join(dir, name), 'utf8')
      const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      if (!match) throw new Error(`No frontmatter block in ${locale}/${name}`)
      stories.push({
        file: `${locale}/${name}`,
        frontmatter: match[1],
        body: match[2]
      })
    }
  }
  return stories
}

// The TOC sidebar is built from frontmatter `sections`, but the scroll-spy
// anchors come from `<Section id="...">` in the body. Nothing binds the two but
// matching strings, so this guards against silent drift (a renamed body id or a
// missing frontmatter entry would leave the nav pointing at a dead anchor).
function frontmatterSections(
  frontmatter: string
): { id: string; label: string }[] {
  const sections: { id: string; label: string }[] = []
  const pattern = /-\s*id:\s*(\S+)\s*\n\s*label:\s*(.+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(frontmatter)) !== null) {
    sections.push({
      id: match[1].trim(),
      label: match[2].trim().replace(/^["']|["']$/g, '')
    })
  }
  return sections
}

function bodySectionIds(body: string): string[] {
  const ids: string[] = []
  const pattern = /<Section\b[^>]*\bid="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(body)) !== null) {
    ids.push(match[1])
  }
  return ids
}

const stories = loadStories()

it('finds customer stories in every locale', () => {
  for (const locale of locales) {
    const prefix = `${locale}/`
    const inLocale = stories.filter((story) => story.file.startsWith(prefix))
    expect(inLocale.length).toBeGreaterThan(0)
  }
})

describe.for(stories)('$file', ({ frontmatter, body }) => {
  const sections = frontmatterSections(frontmatter)
  const bodyIds = bodySectionIds(body)

  it('declares at least one section', () => {
    expect(sections.length).toBeGreaterThan(0)
  })

  it('has a non-empty id and label for every section', () => {
    for (const section of sections) {
      expect(section.id).not.toBe('')
      expect(section.label).not.toBe('')
    }
  })

  it('gives every body <Section> an id', () => {
    expect(bodyIds).not.toContain('')
    expect(bodyIds.length).toBeGreaterThan(0)
  })

  it('matches frontmatter section ids to body <Section> ids', () => {
    const fromFrontmatter = [
      ...new Set(sections.map((section) => section.id))
    ].sort()
    const fromBody = [...new Set(bodyIds)].sort()
    expect(fromBody).toEqual(fromFrontmatter)
  })
})

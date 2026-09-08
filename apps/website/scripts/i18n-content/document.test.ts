import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  applyCustomersTranslations,
  applyFaqTranslations,
  customersTranslatableFields,
  discoverDocuments,
  faqTranslatableFields,
  findMdxSyntaxErrors,
  joinBody,
  parseDocument,
  readDocument,
  serializeDocument,
  splitBody
} from './document'
import type { CustomersFrontmatter, FaqFrontmatter } from './document'

const customerFixture = `---
title: "Built for AI"
category: "SHOWCASE"
description: "A description."
cover: "https://media.comfy.org/cover.png"
order: 4
sections:
  - id: topic-1
    label: "THE PROGRAM"
  - id: topic-2
    label: "TEACHING WITH AI"
---

<Section id="topic-1">

### A question?

Some prose with a [link](https://docs.comfy.org/tutorials).

</Section>
`

const faqFixture = `---
question: "What are Partner Nodes, and do they cost extra?"
order: 14
---

Partner Nodes let you run proprietary models. [Read more](https://docs.comfy.org/tutorials/partner-nodes/overview).
`

describe('parseDocument', () => {
  it('splits a customer story into frontmatter and body', () => {
    const { frontmatter, body } =
      parseDocument<CustomersFrontmatter>(customerFixture)
    expect(frontmatter.title).toBe('Built for AI')
    expect(frontmatter.sections).toEqual([
      { id: 'topic-1', label: 'THE PROGRAM' },
      { id: 'topic-2', label: 'TEACHING WITH AI' }
    ])
    expect(body).toContain('<Section id="topic-1">')
    expect(body).toContain('[link](https://docs.comfy.org/tutorials)')
  })

  it('splits an FAQ entry into frontmatter and body', () => {
    const { frontmatter, body } = parseDocument<FaqFrontmatter>(faqFixture)
    expect(frontmatter.question).toBe(
      'What are Partner Nodes, and do they cost extra?'
    )
    expect(frontmatter.order).toBe(14)
    expect(body).toContain('Partner Nodes let you run proprietary models.')
  })
})

describe('customersTranslatableFields + applyCustomersTranslations', () => {
  it('extracts title, category, description, and every section label', () => {
    const { frontmatter } = parseDocument<CustomersFrontmatter>(customerFixture)
    expect(customersTranslatableFields(frontmatter)).toEqual([
      { path: 'title', value: 'Built for AI' },
      { path: 'category', value: 'SHOWCASE' },
      { path: 'description', value: 'A description.' },
      { path: 'sections.0.label', value: 'THE PROGRAM' },
      { path: 'sections.1.label', value: 'TEACHING WITH AI' }
    ])
  })

  it('applies translations without touching cover, order, or section ids', () => {
    const { frontmatter } = parseDocument<CustomersFrontmatter>(customerFixture)
    const translated = applyCustomersTranslations(
      frontmatter,
      new Map([
        ['title', 'AIのために作られた'],
        ['sections.0.label', 'プログラム']
      ])
    )
    expect(translated.title).toBe('AIのために作られた')
    expect(translated.category).toBe('SHOWCASE')
    expect(translated.cover).toBe('https://media.comfy.org/cover.png')
    expect(translated.order).toBe(4)
    expect(translated.sections).toEqual([
      { id: 'topic-1', label: 'プログラム' },
      { id: 'topic-2', label: 'TEACHING WITH AI' }
    ])
  })
})

describe('faqTranslatableFields + applyFaqTranslations', () => {
  it('extracts only the question', () => {
    const { frontmatter } = parseDocument<FaqFrontmatter>(faqFixture)
    expect(faqTranslatableFields(frontmatter)).toEqual([
      {
        path: 'question',
        value: 'What are Partner Nodes, and do they cost extra?'
      }
    ])
  })

  it('applies the translated question without touching order', () => {
    const { frontmatter } = parseDocument<FaqFrontmatter>(faqFixture)
    const translated = applyFaqTranslations(
      frontmatter,
      new Map([['question', 'パートナーノードとは？']])
    )
    expect(translated.question).toBe('パートナーノードとは？')
    expect(translated.order).toBe(14)
  })
})

describe('serializeDocument', () => {
  it('round-trips frontmatter and body through parseDocument', () => {
    const { frontmatter, body } = parseDocument<FaqFrontmatter>(faqFixture)
    const serialized = serializeDocument(frontmatter, body)
    const reparsed = parseDocument<FaqFrontmatter>(serialized)
    expect(reparsed.frontmatter).toEqual(frontmatter)
    expect(reparsed.body).toBe(body)
  })

  it('preserves a body that opens with an indented code block', () => {
    const fixture = `---
question: "How do I run this?"
order: 1
---

    def example():
        return 1
`
    const { frontmatter, body } = parseDocument<FaqFrontmatter>(fixture)
    const reparsed = parseDocument<FaqFrontmatter>(
      serializeDocument(frontmatter, body)
    )
    expect(reparsed.body).toBe(body)
    expect(reparsed.body).toContain('    def example():')
  })
})

describe('splitBody + joinBody', () => {
  it('splits multiple <Section> blocks out as separate translatable segments', () => {
    const body =
      '\n<Section id="a">one</Section>\n\n<Section id="b">two</Section>\n'
    const segments = splitBody(body)

    expect(segments).toEqual([
      { translatable: false, text: '\n' },
      { translatable: true, text: '<Section id="a">one</Section>' },
      { translatable: false, text: '\n\n' },
      { translatable: true, text: '<Section id="b">two</Section>' },
      { translatable: false, text: '\n' }
    ])
    expect(joinBody(segments)).toBe(body)
  })

  it('treats a body with no <Section> tags as one translatable segment', () => {
    const body = '\nPartner Nodes let you run proprietary models.\n'

    const segments = splitBody(body)

    expect(segments).toEqual([{ translatable: true, text: body }])
    expect(joinBody(segments)).toBe(body)
  })

  it('translates an <AuthorBio> children block outside any <Section>', () => {
    const body =
      '<Section id="a">one</Section>\n\n<AuthorBio>Jane is an artist.</AuthorBio>\n'
    const segments = splitBody(body)

    expect(segments).toContainEqual({
      translatable: true,
      text: '<AuthorBio>Jane is an artist.</AuthorBio>'
    })
    expect(joinBody(segments)).toBe(body)
  })

  it('translates a bio: field inside a self-closing <AuthorBio /> without disturbing its structure', () => {
    const body =
      '<Section id="a">one</Section>\n\n<AuthorBio people={[{ name: "Jane", bio: `Jane is an artist.` }]} />\n'
    const segments = splitBody(body)

    expect(segments).toContainEqual({
      translatable: true,
      text: 'Jane is an artist.'
    })
    expect(joinBody(segments)).toBe(body)
  })

  it('extracts a bio: field from a body that is only a standalone self-closing <AuthorBio />', () => {
    const body =
      '<AuthorBio people={[{ name: "Jane", bio: `Jane is an artist.` }]} />\n'
    const segments = splitBody(body)

    const translatable = segments.filter((s) => s.translatable)
    expect(translatable).toHaveLength(1)
    expect(translatable[0].text).toBe('Jane is an artist.')
    expect(joinBody(segments)).toBe(body)
  })

  it('keeps prose translatable before and after a self-closing component with no bio: field', () => {
    const body = 'Intro text.\n\n<Figure src="x.png" alt="a" />\n\nOutro text.'
    const segments = splitBody(body)

    expect(segments).toContainEqual({
      translatable: true,
      text: 'Intro text.\n\n'
    })
    expect(segments).toContainEqual({
      translatable: false,
      text: '<Figure src="x.png" alt="a" />'
    })
    expect(segments).toContainEqual({
      translatable: true,
      text: '\n\nOutro text.'
    })
    expect(joinBody(segments)).toBe(body)
  })

  it('finds the true matching close of a component nested inside itself', () => {
    const body = '<Section><Section>inner</Section> outer-after</Section>'
    const segments = splitBody(body)

    expect(segments).toEqual([{ translatable: true, text: body }])
    expect(joinBody(segments)).toBe(body)
  })

  it('does not mistake a quoted > for a component boundary', () => {
    const body =
      '<Section title="A > B">first</Section>\n<Section>second</Section>'
    const segments = splitBody(body)

    expect(segments).toEqual([
      { translatable: true, text: '<Section title="A > B">first</Section>' },
      { translatable: false, text: '\n' },
      { translatable: true, text: '<Section>second</Section>' }
    ])
    expect(joinBody(segments)).toBe(body)
  })
})

describe('findMdxSyntaxErrors', () => {
  it('is silent on well-formed nested components', () => {
    expect(
      findMdxSyntaxErrors(
        '<Section id="a"><Quote>text</Quote><Figure src="x.png" /></Section>'
      )
    ).toEqual([])
  })

  it('flags a tag that is never closed', () => {
    expect(findMdxSyntaxErrors('<Section id="a">text')).toEqual([
      '<Section> is never closed'
    ])
  })

  it('flags a mismatched closing tag', () => {
    expect(findMdxSyntaxErrors('<Section id="a">text</Quote>')).toEqual([
      '</Quote> does not match the open <Section>'
    ])
  })

  it('flags an unbalanced opening brace', () => {
    expect(findMdxSyntaxErrors('<Figure people={[{ name: "a" }]} />')).toEqual(
      []
    )
    expect(findMdxSyntaxErrors('text with a stray {brace')).toEqual([
      'unbalanced braces: 1 unclosed {'
    ])
  })

  it('flags an unbalanced closing brace', () => {
    expect(findMdxSyntaxErrors('text with a stray }brace')).toEqual([
      'unbalanced braces: unexpected }'
    ])
  })

  it('does not mistake a > inside a quoted attribute for the tag close', () => {
    expect(
      findMdxSyntaxErrors('<Section title="A > B">text</Section>')
    ).toEqual([])
  })
})

describe('discoverDocuments', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'i18n-content-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('finds customer stories and categorized FAQ entries by their English source', () => {
    mkdirSync(join(dir, 'customers', 'en'), { recursive: true })
    writeFileSync(
      join(dir, 'customers', 'en', 'kathy-smith.mdx'),
      customerFixture
    )
    mkdirSync(join(dir, 'faq', 'pricing', 'en'), { recursive: true })
    writeFileSync(
      join(dir, 'faq', 'pricing', 'en', 'partner-nodes.mdx'),
      faqFixture
    )

    const refs = discoverDocuments(dir)

    expect(refs.map((ref) => ref.id)).toEqual([
      'customers/kathy-smith',
      'faq/pricing/partner-nodes'
    ])
    expect(refs[0].localePath('ja')).toBe(
      join(dir, 'customers', 'ja', 'kathy-smith.mdx')
    )
    expect(refs[1].localePath('ja')).toBe(
      join(dir, 'faq', 'pricing', 'ja', 'partner-nodes.mdx')
    )
  })

  it('ignores a directory that happens to be named like an .mdx file', () => {
    mkdirSync(join(dir, 'customers', 'en'), { recursive: true })
    writeFileSync(
      join(dir, 'customers', 'en', 'kathy-smith.mdx'),
      customerFixture
    )
    mkdirSync(join(dir, 'customers', 'en', 'draft.mdx'), { recursive: true })

    const refs = discoverDocuments(dir)

    expect(refs.map((ref) => ref.id)).toEqual(['customers/kathy-smith'])
  })

  it('parses a discovered document according to its kind', () => {
    mkdirSync(join(dir, 'customers', 'en'), { recursive: true })
    const path = join(dir, 'customers', 'en', 'kathy-smith.mdx')
    writeFileSync(path, customerFixture)

    const [ref] = discoverDocuments(dir)
    const { frontmatter } = readDocument(ref, path) as {
      frontmatter: CustomersFrontmatter
    }

    expect(frontmatter.title).toBe('Built for AI')
  })
})

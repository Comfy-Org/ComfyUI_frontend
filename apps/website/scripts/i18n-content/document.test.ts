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
  parseDocument,
  readDocument,
  serializeDocument
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
    expect(reparsed.body.trim()).toBe(body.trim())
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

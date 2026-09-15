import { describe, expect, it } from 'vitest'

import {
  entriesFromStories,
  identifierValues,
  parseStory,
  readStories,
  sectionsRequiringTranslation,
  storyAdapter
} from './story'

const STORY = `---
title: "Seeing the world in new ways"
category: "CREATIVE CAMPUS SHOWCASE"
description: "What they built."
cover: https://media.comfy.org/website/customers/x.jpg
order: 3
sections:
  - id: topic-1
    label: INTRO
  - id: topic-2
    label: THE WORK
---

<Section id="topic-1" title="At a glance">

Comfy Org announced a partnership.

<Figure src="https://media.comfy.org/a.jpg" alt="A diagram" caption="A caption" />

</Section>
`

describe('parseStory', () => {
  const story = parseStory('en/golan-levin', STORY)

  it('reads the fields a reader sees', () => {
    expect(story.title).toBe('Seeing the world in new ways')
    expect(story.category).toBe('CREATIVE CAMPUS SHOWCASE')
    expect(story.description).toBe('What they built.')
  })

  it('reads sections in order, keeping id and label together', () => {
    expect(story.sections).toEqual([
      { id: 'topic-1', label: 'INTRO' },
      { id: 'topic-2', label: 'THE WORK' }
    ])
  })

  it('reads the locale and slug out of the id', () => {
    expect(story.locale).toBe('en')
    expect(story.slug).toBe('golan-levin')
  })

  it('notices the pipeline wrote it', () => {
    const generated = STORY.replace(
      'order: 3',
      'order: 3\ntranslatedBy: machine'
    )

    expect(parseStory('ja/x', generated).machineWritten).toBe(true)
    expect(story.machineWritten).toBe(false)
  })
})

describe('entriesFromStories', () => {
  const english = parseStory('en/golan-levin', STORY)

  it('keys a section label by its id, never its position', () => {
    // Section order can change; the id cannot, because the body anchors to it.
    // An index would renumber every label the first time a section moved.
    const keys = entriesFromStories([english]).map((entry) => entry.key)

    expect(keys).toContain('story.golan-levin.section.topic-1.label')
    expect(keys).toContain('story.golan-levin.section.topic-2.label')
  })

  it('emits every translatable field and nothing else', () => {
    const keys = entriesFromStories([english])
      .map((entry) => entry.key.replace('story.golan-levin.', ''))
      .sort()

    // topic-2 has a label but no <Section> in this fixture, so it contributes a
    // label key and no body key — which is the point of keying them separately.
    expect(keys).toEqual([
      'category',
      'description',
      'section.topic-1.body',
      'section.topic-1.label',
      'section.topic-2.label',
      'title'
    ])
  })

  it('never emits cover, order or readMore', () => {
    // A URL and a sort key. The Chinese files leave all three byte-identical.
    const keys = entriesFromStories([english]).map((entry) => entry.key)

    expect(keys.some((key) => /\.(cover|order|readMore)$/.test(key))).toBe(
      false
    )
  })

  it('treats a translation a person wrote as approved', () => {
    const chinese = parseStory(
      'zh-CN/golan-levin',
      STORY.replace('Seeing the world in new ways', '以全新方式观察世界')
    )
    const title = entriesFromStories([english, chinese]).find((entry) =>
      entry.key.endsWith('.title')
    )

    expect(title?.approved['zh-CN']).toBe('以全新方式观察世界')
  })

  it('does not treat its own output as approved', () => {
    const generated = parseStory(
      'ja/golan-levin',
      STORY.replace('order: 3', 'order: 3\ntranslatedBy: machine')
    )

    expect(
      entriesFromStories([english, generated]).every(
        (entry) => entry.approved.ja === undefined
      )
    ).toBe(true)
  })
})

describe('the story adapter over src/content/customers', () => {
  const entries = storyAdapter.read()

  it('gives every entry a unique key', () => {
    expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length)
  })

  /*
   * Stated as invariants rather than as a count and a coverage percentage.
   * `covers all eleven stories` failed the moment a twelfth was written, and
   * `has Chinese for every entry` failed when an English story landed before
   * its translation — both naming the adapter, so a contributor goes looking
   * for a defect that is not there. Whether Chinese is complete belongs to the
   * coverage gate, not here.
   */
  it('contributes at least a title for every English story', () => {
    const english = readStories().filter((story) => story.locale === 'en')

    expect(english.length).toBeGreaterThan(0)
    for (const story of english) {
      expect(
        entries.some((entry) => entry.key === `story.${story.slug}.title`),
        `${story.slug} contributed no title`
      ).toBe(true)
    }
  })

  it('carries the approved Chinese where a Chinese story supplies it', () => {
    const chinese = readStories().filter((story) => story.locale === 'zh-CN')

    expect(chinese.length).toBeGreaterThan(0)
    for (const story of chinese) {
      const title = entries.find(
        (entry) => entry.key === `story.${story.slug}.title`
      )
      expect(title?.approved['zh-CN'], `${story.slug} title`).toBe(story.title)
    }
  })

  it('never emits an entry with nothing to translate', () => {
    expect(entries.filter((e) => e.english.trim() === '')).toEqual([])
  })
})

describe('identifierValues', () => {
  it('collects the identifiers a translator must not touch', () => {
    expect(
      identifierValues(
        '<Video src="https://media.comfy.org/a.mp4" id="hero" />'
      )
    ).toEqual(['https://media.comfy.org/a.mp4', 'hero'])
  })

  /**
   * The attribute run stopped at the first attribute it could not parse, so an
   * identifier standing after a hyphenated name, a brace value or a
   * single-quoted value was never collected — and an uncollected identifier is
   * one the translator is not told to preserve and the verifier does not check.
   * A guard that protects fewer things than it appears to is worse than none,
   * because the green result is what people trust.
   */
  it('reaches an identifier standing after an attribute it cannot parse', () => {
    expect(identifierValues('<Video data-track="x" id="hero" />')).toContain(
      'hero'
    )
    expect(identifierValues('<Video width={800} src="/a.mp4" />')).toContain(
      '/a.mp4'
    )
    expect(identifierValues('<Video alt=\'x\' href="/b" />')).toContain('/b')
  })
})

describe('sectionsRequiringTranslation', () => {
  const story = (frontmatterSections: string, body: string) =>
    parseStory(
      'en/x',
      `---\ntitle: "T"\ncategory: "C"\ndescription: "D"\ncover: https://x/y.jpg\norder: 1\nsections:\n${frontmatterSections}---\n${body}`
    )

  it('asks for a translation of every section the body opens', () => {
    const parsed = story(
      '  - id: one\n    label: ONE\n  - id: two\n    label: TWO\n',
      '<Section id="one">a</Section>\n<Section id="two">b</Section>\n'
    )

    expect(sectionsRequiringTranslation(parsed)).toEqual(['one', 'two'])
  })

  /**
   * The writer used to derive this from the frontmatter list. A section
   * declared there but never opened in the body has no text to translate, so a
   * translation for it can never arrive — and the story stayed in
   * `untranslated` forever, waiting on a section that renders nothing. No story
   * does this today; the two lists agreeing is what makes it invisible.
   */
  it('ignores a section declared in frontmatter but absent from the body', () => {
    const parsed = story(
      '  - id: one\n    label: ONE\n  - id: ghost\n    label: GHOST\n',
      '<Section id="one">a</Section>\n'
    )

    expect(sectionsRequiringTranslation(parsed)).toEqual(['one'])
  })

  it('has nothing to ask of a story with no sections', () => {
    expect(sectionsRequiringTranslation(story('', 'Just prose.\n'))).toEqual([])
  })
})

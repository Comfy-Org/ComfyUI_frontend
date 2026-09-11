import { describe, expect, it } from 'vitest'

import { buildStory, parseStory, splitStoryBody, verifyStory } from './story'

const ENGLISH = parseStory(
  'en/ual-cci',
  `---
title: "Comfy and UAL Announce a Partnership"
category: "CREATIVE CAMPUS PARTNERSHIP"
description: "Supporting teaching and research."
cover: "https://media.comfy.org/website/customers/ual-cci/cover.png"
order: 5
sections:
  - id: topic-1
    label: "INTRO"
  - id: topic-2
    label: "THE PARTNERSHIP"
---

<Section id="topic-1" title="At a glance">

Comfy Org announced a Creative Campus partnership today.

<Figure src="https://media.comfy.org/a.png" alt="A diagram" caption="A caption" />

</Section>

<Section id="topic-2">

<Quote name="Prof Mick Grierson, Research Leader">ComfyUI is part of how we teach.</Quote>

</Section>

<AuthorBio label="About the author" />
`
)

const JAPANESE = {
  title: 'Comfy と UAL がパートナーシップを発表',
  category: 'クリエイティブ・キャンパス・パートナーシップ',
  description: '教育と研究を支援します。',
  sections: { 'topic-1': 'はじめに', 'topic-2': 'パートナーシップ' },
  sectionBodies: {
    'topic-1': `<Section id="topic-1" title="概要">

Comfy Org は本日、クリエイティブ・キャンパス・パートナーシップを発表しました。

<Figure src="https://media.comfy.org/a.png" alt="図" caption="キャプション" />

</Section>`,
    'topic-2': `<Section id="topic-2">

<Quote name="Mick Grierson 教授、リサーチリーダー">ComfyUI は私たちの教育の一部です。</Quote>

</Section>`
  },
  between: ['<AuthorBio label="著者について" />\n']
}

/**
 * A body is keyed per section rather than as one string, so a typo fixed in one
 * paragraph does not re-translate and re-bill 2,117 words. The seam is the
 * markup's own, and splitting on it is lossless.
 */
describe('splitStoryBody', () => {
  it('splits into sections and the prose between them', () => {
    const pieces = splitStoryBody(ENGLISH.body)
    const sections = pieces.filter((piece) => piece.kind === 'section')

    expect(sections.map((piece) => piece.id)).toEqual(['topic-1', 'topic-2'])
  })

  it('rejoins to exactly what it was given', () => {
    // If this were lossy every regeneration would reformat the file, which is a
    // worse problem than the one splitting solves.
    const rejoined = splitStoryBody(ENGLISH.body)
      .map((piece) => piece.text)
      .join('')

    expect(rejoined).toBe(ENGLISH.body)
  })
})

describe('buildStory', () => {
  const built = buildStory(ENGLISH, JAPANESE)
  const parsed = parseStory('ja/ual-cci', built)

  it('reads back as the story it was given', () => {
    expect(parsed.title).toBe(JAPANESE.title)
    expect(parsed.category).toBe(JAPANESE.category)
    expect(parsed.description).toBe(JAPANESE.description)
  })

  it('keeps section ids and their order, with translated labels', () => {
    expect(parsed.sections).toEqual([
      { id: 'topic-1', label: 'はじめに' },
      { id: 'topic-2', label: 'パートナーシップ' }
    ])
  })

  it('reassembles every section body in order', () => {
    expect(parsed.body).toContain(
      'クリエイティブ・キャンパス・パートナーシップを発表'
    )
    expect(parsed.body).toContain('私たちの教育の一部です')
    expect(parsed.body.indexOf('topic-1')).toBeLessThan(
      parsed.body.indexOf('topic-2')
    )
  })

  it('carries the prose between sections across', () => {
    expect(parsed.body).toContain('著者について')
  })

  /**
   * `between` is a positional list, so a translation that ran short leaves the
   * later indexes with nothing. A type-aware linter reads the lookup as always
   * returning a string and calls the guard dead; it is not, and this is the
   * case that proves it.
   */
  it('falls back to English for prose the translation ran out of', () => {
    const partial = buildStory(ENGLISH, { ...JAPANESE, between: [] })

    expect(partial).toContain('<AuthorBio label="About the author" />')
    expect(partial).not.toContain('著者について')
  })

  it('falls back to English for a section with no translation', () => {
    const partial = buildStory(ENGLISH, {
      ...JAPANESE,
      sectionBodies: { 'topic-1': JAPANESE.sectionBodies['topic-1'] }
    })

    // Better a section in English than a hole where one used to be.
    expect(partial).toContain('ComfyUI is part of how we teach.')
  })

  it('carries cover and order across untouched', () => {
    expect(built).toContain(
      'cover: "https://media.comfy.org/website/customers/ual-cci/cover.png"'
    )
    expect(built).toContain('order: 5')
  })

  it('marks itself as machine-written', () => {
    expect(parsed.machineWritten).toBe(true)
  })
})

/**
 * The JSX is the whole risk here. A translated `id` breaks the table of
 * contents, a translated `src` breaks an image, and neither shows up as
 * anything but a page that quietly looks wrong.
 */
describe('verifyStory', () => {
  it('passes a faithful translation', () => {
    expect(verifyStory(ENGLISH, buildStory(ENGLISH, JAPANESE))).toEqual([])
  })

  it('catches a section id that was translated', () => {
    const broken = buildStory(ENGLISH, {
      ...JAPANESE,
      sectionBodies: {
        ...JAPANESE.sectionBodies,
        'topic-1': JAPANESE.sectionBodies['topic-1'].replace(
          'id="topic-1"',
          'id="トピック1"'
        )
      }
    })

    expect(verifyStory(ENGLISH, broken)).not.toEqual([])
  })

  it('catches an image source that changed', () => {
    const broken = buildStory(ENGLISH, {
      ...JAPANESE,
      sectionBodies: {
        ...JAPANESE.sectionBodies,
        'topic-1': JAPANESE.sectionBodies['topic-1'].replace('a.png', 'b.png')
      }
    })

    expect(verifyStory(ENGLISH, broken).join(' ')).toContain('src')
  })

  it('catches a component the translation dropped', () => {
    const broken = buildStory(ENGLISH, {
      ...JAPANESE,
      sectionBodies: {
        ...JAPANESE.sectionBodies,
        'topic-1': JAPANESE.sectionBodies['topic-1'].replace(
          /<Figure[^>]*\/>/,
          ''
        )
      }
    })

    expect(verifyStory(ENGLISH, broken).join(' ')).toContain('Figure')
  })

  it('catches a body left in English', () => {
    const broken = buildStory(ENGLISH, {
      ...JAPANESE,
      sectionBodies: {},
      between: []
    })

    expect(verifyStory(ENGLISH, broken).join(' ')).toContain('English')
  })

  it('catches a label the translation forgot', () => {
    const broken = buildStory(ENGLISH, {
      ...JAPANESE,
      sections: { 'topic-1': 'はじめに', 'topic-2': 'THE PARTNERSHIP' }
    })

    expect(verifyStory(ENGLISH, broken).join(' ')).toContain('topic-2')
  })
})

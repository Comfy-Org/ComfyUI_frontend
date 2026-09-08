import { describe, expect, it } from 'vitest'

import { buildStory, parseStory, verifyStory } from './story'

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
`
)

const JAPANESE = {
  title: 'Comfy と UAL がパートナーシップを発表',
  category: 'クリエイティブ・キャンパス・パートナーシップ',
  description: '教育と研究を支援します。',
  sections: { 'topic-1': 'はじめに', 'topic-2': 'パートナーシップ' },
  body: `<Section id="topic-1" title="概要">

Comfy Org は本日、クリエイティブ・キャンパス・パートナーシップを発表しました。

<Figure src="https://media.comfy.org/a.png" alt="図" caption="キャプション" />

</Section>

<Section id="topic-2">

<Quote name="Mick Grierson 教授、リサーチリーダー">ComfyUI は私たちの教育の一部です。</Quote>

</Section>
`
}

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
  const good = buildStory(ENGLISH, JAPANESE)

  it('passes a faithful translation', () => {
    expect(verifyStory(ENGLISH, good)).toEqual([])
  })

  it('catches a section id that was translated', () => {
    const broken = buildStory(ENGLISH, {
      ...JAPANESE,
      body: JAPANESE.body.replace('id="topic-1"', 'id="トピック1"')
    })

    expect(verifyStory(ENGLISH, broken).join(' ')).toContain('topic-1')
  })

  it('catches an image source that changed', () => {
    const broken = buildStory(ENGLISH, {
      ...JAPANESE,
      body: JAPANESE.body.replace('a.png', 'b.png')
    })

    expect(verifyStory(ENGLISH, broken).join(' ')).toContain('src')
  })

  it('catches a component the translation dropped', () => {
    const broken = buildStory(ENGLISH, {
      ...JAPANESE,
      body: JAPANESE.body.replace(/<Figure[^>]*\/>/, '')
    })

    expect(verifyStory(ENGLISH, broken).join(' ')).toContain('Figure')
  })

  it('catches a section missing from the body', () => {
    const broken = buildStory(ENGLISH, {
      ...JAPANESE,
      body: JAPANESE.body.replace('<Section id="topic-2">', '<Section>')
    })

    expect(verifyStory(ENGLISH, broken)).not.toEqual([])
  })

  it('catches a body left in English', () => {
    const broken = buildStory(ENGLISH, { ...JAPANESE, body: ENGLISH.body })

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

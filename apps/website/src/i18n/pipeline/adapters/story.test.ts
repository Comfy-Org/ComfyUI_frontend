import { describe, expect, it } from 'vitest'

import { entriesFromStories, parseStory, storyAdapter } from './story'

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

  it('covers all eleven stories', () => {
    const slugs = new Set(entries.map((e) => e.key.split('.')[1]))
    expect(slugs.size).toBe(11)
  })

  it('has Chinese for every entry', () => {
    expect(entries.filter((e) => e.approved['zh-CN']).length).toBe(
      entries.length
    )
  })

  it('never emits an entry with nothing to translate', () => {
    expect(entries.filter((e) => e.english.trim() === '')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'

import { customerStorySchema } from './customers.schema'

/**
 * Same provenance marker as the FAQ collection, for the same reason: generated
 * and hand-written stories share a `<locale>/` folder, so the file has to say
 * which it is or a run cannot tell reviewed Chinese from its own output.
 */
describe('customerStorySchema', () => {
  const story = {
    title: 'A story',
    category: 'CREATIVE CAMPUS SHOWCASE',
    description: 'What they built.',
    cover: 'https://media.comfy.org/website/customers/x.jpg',
    order: 3,
    sections: [{ id: 'topic-1', label: 'INTRO' }]
  }

  it('accepts a story a person wrote, with no marker', () => {
    expect(customerStorySchema.safeParse(story).success).toBe(true)
  })

  it('accepts a story the pipeline generated', () => {
    expect(
      customerStorySchema.safeParse({ ...story, translatedBy: 'machine' })
        .success
    ).toBe(true)
  })

  it('rejects any other provenance, so the marker keeps one meaning', () => {
    expect(
      customerStorySchema.safeParse({ ...story, translatedBy: 'human' }).success
    ).toBe(false)
  })

  it('still rejects a field nobody declared', () => {
    // The existing comment on this schema calls out `readMoreHref` as the
    // misspelling it is meant to catch.
    expect(
      customerStorySchema.safeParse({ ...story, readMoreHref: 'https://x.dev' })
        .success
    ).toBe(false)
  })
})

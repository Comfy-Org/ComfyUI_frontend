import { describe, expect, it } from 'vitest'

import { faqSchema } from './faq.schema'

/**
 * `translatedBy` is how a generated answer is told apart from one a person
 * wrote. Both land in the same `<category>/<locale>/` folder, so without a
 * marker in the file there is nothing to distinguish them, and the first
 * pipeline run would be free to overwrite reviewed Chinese.
 *
 * The schema is strict, so it has to be taught the field before any generated
 * file can exist — an unknown key fails the build, not the run that wrote it.
 */
describe('faqSchema', () => {
  const entry = { question: 'Does it work?', order: 3 }

  it('accepts an entry a person wrote, with no marker', () => {
    expect(faqSchema.safeParse(entry).success).toBe(true)
  })

  it('accepts an entry the pipeline generated', () => {
    expect(
      faqSchema.safeParse({ ...entry, translatedBy: 'machine' }).success
    ).toBe(true)
  })

  it('rejects any other provenance, so the marker keeps one meaning', () => {
    expect(
      faqSchema.safeParse({ ...entry, translatedBy: 'human' }).success
    ).toBe(false)
  })

  it('still rejects a field nobody declared', () => {
    expect(faqSchema.safeParse({ ...entry, sections: [] }).success).toBe(false)
  })
})

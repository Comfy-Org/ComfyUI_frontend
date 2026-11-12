import { describe, expect, it } from 'vitest'

import { refusedAttachmentsMessage } from './attachmentMessages'

describe('refusedAttachmentsMessage', () => {
  it('names a single refusal in the singular', () => {
    expect(refusedAttachmentsMessage(['doc.pdf'])).toBe(
      'doc.pdf is not a file type the agent accepts'
    )
  })

  it('uses the plural form for several', () => {
    expect(refusedAttachmentsMessage(['doc.pdf', 'clip.wmv'])).toBe(
      'doc.pdf, clip.wmv are not file types the agent accepts'
    )
  })

  it('caps the names it prints and says how many it withheld', () => {
    expect(
      refusedAttachmentsMessage(['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf', 'e.pdf'])
    ).toBe(
      'a.pdf, b.pdf, c.pdf and 2 more are not file types the agent accepts'
    )
  })

  it('reports the server total rather than the length of the capped list', () => {
    const message = refusedAttachmentsMessage(['a.pdf', 'b.pdf', 'c.pdf'], 40)
    expect(message).toBe(
      'a.pdf, b.pdf, c.pdf and 37 more are not file types the agent accepts'
    )
  })

  it('uses the server total when the capped list contains no names', () => {
    expect(refusedAttachmentsMessage([], 12)).toBe(
      '12 are not file types the agent accepts'
    )
  })

  it('does not claim an overflow when the list is complete', () => {
    expect(refusedAttachmentsMessage(['a.pdf', 'b.pdf'], 2)).toBe(
      'a.pdf, b.pdf are not file types the agent accepts'
    )
  })
})

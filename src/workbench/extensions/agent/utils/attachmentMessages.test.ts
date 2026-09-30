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

  /* The server caps AgentAttachmentRejected.rejected and reports the real
     figure in rejected_count, so counting the array understates the refusal —
     the user would be told 3 files were rejected when 40 were. */
  it('reports the server total rather than the length of the capped list', () => {
    const message = refusedAttachmentsMessage(['a.pdf', 'b.pdf', 'c.pdf'], 40)
    expect(message).toContain('and 37 more')
    expect(message).toContain('are not file types')
  })

  it('does not claim an overflow when the list is complete', () => {
    expect(refusedAttachmentsMessage(['a.pdf', 'b.pdf'], 2)).not.toContain(
      'more'
    )
  })
})

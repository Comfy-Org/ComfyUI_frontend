import { describe, expect, it } from 'vitest'

import { agentMessageText } from './agentMessageText'

describe('readable agent message', () => {
  it('preserves inline workflow order and all available node and asset context', () => {
    expect(
      agentMessageText({
        text: 'Compare  with .',
        workflowReferences: [
          { id: 'a', name: 'Portrait', textOffset: 8 },
          { id: 'b', name: 'Landscape', textOffset: 14 }
        ],
        tags: ['KSampler #12'],
        attachments: [{ name: 'reference.png' }, { name: 'notes.txt' }]
      })
    ).toBe(
      'Compare @[Workflow: Portrait] with @[Workflow: Landscape].\n@[Node: KSampler #12]\n@[Image: reference.png]\n@[File: notes.txt]'
    )
  })

  /**
   * A rehydrated library asset is named by its storage ref, which can be a
   * bare content hash with no extension to classify it by. The grid labels it
   * from the kind the server resolved, so this has to read the same kind or a
   * refreshed turn copies `File` for a tile rendering a picture.
   */
  it('labels an attachment by the resolved kind when its name has no extension', () => {
    const bareDigest = 'a'.repeat(64)

    expect(
      agentMessageText({
        text: 'upscale this',
        attachments: [{ name: bareDigest, ref: bareDigest, kind: 'image' }]
      })
    ).toBe(`upscale this\n@[Image: ${bareDigest}]`)
  })

  it('does not duplicate context already included inline', () => {
    const text = 'Use @[Node: KSampler #12] with @[Image: reference.png].'
    expect(
      agentMessageText({
        text,
        tags: ['KSampler #12'],
        attachments: [{ name: 'reference.png' }]
      })
    ).toBe(text)
  })

  it('copies context-only messages and preserves ordinary prompt whitespace', () => {
    expect(agentMessageText({ text: '', tags: ['Load Image #2'] })).toBe(
      '@[Node: Load Image #2]'
    )
    expect(agentMessageText({ text: '  first\nsecond  ' })).toBe(
      '  first\nsecond  '
    )
  })
})

import { describe, expect, it } from 'vitest'

import {
  decodeInteractionMedia,
  encodeInteractionMedia,
  parseInteractionControl
} from '@/services/interactionProtocol'

describe('interaction media protocol', () => {
  it('round trips metadata and binary media', () => {
    const metadata = {
      v: 1 as const,
      interaction_id: 'session',
      prompt_id: 'prompt',
      channel: 'source' as const,
      seq: 3,
      capture_ts_ms: 42,
      mime: 'image/jpeg' as const
    }
    const media = new Uint8Array([0, 1, 255]).buffer

    const decoded = decodeInteractionMedia(
      encodeInteractionMedia(metadata, media)
    )

    expect(decoded.metadata).toEqual(metadata)
    expect(new Uint8Array(decoded.media)).toEqual(new Uint8Array(media))
  })

  it('rejects malformed frame lengths', () => {
    const frame = new ArrayBuffer(9)
    const view = new DataView(frame)
    view.setUint32(0, 5)
    view.setUint32(4, 10)
    expect(() => decodeInteractionMedia(frame)).toThrow(
      'Invalid interaction metadata length'
    )
  })

  it('retains interaction routing fields', () => {
    expect(
      parseInteractionControl({
        v: 1,
        op: 'open',
        interaction_id: 'session',
        prompt_id: 'prompt',
        display_node_id: '12',
        group_id: 'video',
        kind: 'video_stream'
      })
    ).toMatchObject({
      prompt_id: 'prompt',
      display_node_id: '12',
      group_id: 'video',
      kind: 'video_stream'
    })
  })

  it('accepts a null list index from non-list node execution', () => {
    expect(
      parseInteractionControl({
        v: 1,
        op: 'open',
        interaction_id: 'session',
        list_index: null
      }).list_index
    ).toBeNull()
  })

  it.for([
    { v: 1, op: 'open', interaction_id: '' },
    { v: 1, op: 'open', interaction_id: 'session', list_index: -1 },
    {
      v: 1,
      op: 'open',
      interaction_id: 'session',
      limits: { mime_types: [42] }
    },
    {
      v: 1,
      op: 'open',
      interaction_id: 'session',
      limits: { max_frame_bytes: 0 }
    }
  ])('rejects malformed control messages', (control) => {
    expect(() => parseInteractionControl(control)).toThrow()
  })
})

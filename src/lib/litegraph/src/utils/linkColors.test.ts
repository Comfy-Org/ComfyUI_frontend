import { describe, expect, it } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import { resolveConnectingLinkColor } from './linkColors'

describe('resolveConnectingLinkColor', () => {
  it('uses the event link colour for event slots', () => {
    expect(resolveConnectingLinkColor(LiteGraph.EVENT)).toBe(
      LiteGraph.EVENT_LINK_COLOR
    )
  })

  it('uses the connecting link colour for other slot types', () => {
    expect(resolveConnectingLinkColor('STRING')).toBe(
      LiteGraph.CONNECTING_LINK_COLOR
    )
    expect(resolveConnectingLinkColor(undefined)).toBe(
      LiteGraph.CONNECTING_LINK_COLOR
    )
  })
})

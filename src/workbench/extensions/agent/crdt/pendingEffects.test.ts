import type { Op } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'

import type { DocUpdate } from './docFrameClient'
import { PendingEffects } from './pendingEffects'

const SELF = 'human:user-1:tab-1'

function op(opId: string): Op {
  return {
    op: 'delete_node',
    op_id: opId,
    actor: SELF,
    base_version: 4,
    stamp: [4, SELF],
    node_id: 1,
    removed_links: []
  }
}

function update(actor: string, opIds: string[]): DocUpdate {
  return { workflowId: 'wf-1', seq: 5, update: new Uint8Array(), actor, opIds }
}

describe('PendingEffects', () => {
  it('clears on the echoed document effect and attributes a self-only echo', () => {
    const pending = new PendingEffects()
    pending.add([op('a'), op('b')])

    expect(pending.observe(update(SELF, ['a']), SELF)).toBe(true)
    expect(pending.has('a')).toBe(false)
    expect(pending.has('b')).toBe(true)
  })

  it('does not attribute mixed or foreign frames to self', () => {
    const pending = new PendingEffects()
    pending.add([op('a')])

    expect(pending.observe(update(SELF, ['a', 'foreign']), SELF)).toBe(false)
    expect(pending.observe(update('agent:thread:turn', ['a']), SELF)).toBe(
      false
    )
  })
})

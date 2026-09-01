import { describe, expect, it } from 'vitest'

import { parseServerDocFrame } from './docFrameClient'

const validFrames = [
  {
    type: 'doc_update',
    data: {
      v: 1,
      workflow_id: 'workflow_1-ABC',
      seq: 1,
      update_b64: 'AQ==',
      actor: 'agent:thread-1:turn-1'
    }
  },
  {
    type: 'doc_subscribed',
    data: { v: 1, workflow_id: 'workflow_1-ABC', ok: true, seq: 1 }
  },
  {
    type: 'doc_ops_result',
    data: {
      v: 1,
      workflow_id: 'workflow_1-ABC',
      ok: true,
      seq: 1,
      applied: [],
      skipped: []
    }
  },
  {
    type: 'doc_reset',
    data: {
      v: 1,
      workflow_id: 'workflow_1-ABC',
      seq: 1,
      actor: 'system:mint'
    }
  },
  {
    type: 'awareness',
    data: {
      v: 1,
      workflow_id: 'workflow_1-ABC',
      actor: 'human:user-1:tab-1',
      state: {}
    }
  }
] as const

describe('document frame identifier grammar', () => {
  it('rejects a workflow_id exceeding 128 encoded bytes', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_subscribed',
        data: { v: 1, workflow_id: 'w'.repeat(129), ok: true, seq: 1 }
      })
    ).toBeNull()
  })

  it('rejects a workflow_id containing invalid characters', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_subscribed',
        data: { v: 1, workflow_id: 'workflow:invalid', ok: true, seq: 1 }
      })
    ).toBeNull()
  })

  it('rejects an actor exceeding 256 encoded bytes', () => {
    expect(
      parseServerDocFrame({
        type: 'awareness',
        data: {
          v: 1,
          workflow_id: 'workflow-1',
          actor: `human:${'u'.repeat(250)}:tab`,
          state: {}
        }
      })
    ).toBeNull()
  })

  it('rejects an actor outside the closed actor grammar', () => {
    expect(
      parseServerDocFrame({
        type: 'awareness',
        data: {
          v: 1,
          workflow_id: 'workflow-1',
          actor: 'operator:user:tab',
          state: {}
        }
      })
    ).toBeNull()
  })

  it.for(validFrames)('accepts valid identifiers in $type', (frame) => {
    expect(parseServerDocFrame(frame)).not.toBeNull()
  })
})

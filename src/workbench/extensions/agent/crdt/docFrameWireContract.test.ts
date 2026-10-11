import { zDocUpdateFrame, zServerDocFrame } from '@comfyorg/ingest-types/zod'
import { describe, expect, it } from 'vitest'

import { encodeBase64, parseServerDocFrame } from './docFrameClient'

function docUpdateFrame(update_b64: string) {
  return {
    type: 'doc_update',
    data: {
      v: 1,
      workflow_id: 'wf-1',
      seq: 1,
      lineage_seq: 1,
      update_b64
    }
  }
}

const representativeFrames = [
  {
    wire: docUpdateFrame(encodeBase64(Uint8Array.of(1, 2, 3))),
    expected: {
      type: 'doc_update',
      data: {
        workflowId: 'wf-1',
        seq: 1,
        update: Uint8Array.of(1, 2, 3)
      }
    }
  },
  {
    wire: {
      type: 'doc_reset',
      data: { v: 1, workflow_id: 'wf-1', seq: 7, lineage_seq: 2 }
    },
    expected: {
      type: 'doc_reset',
      data: { workflowId: 'wf-1', seq: 7, lineageSeq: 2 }
    }
  },
  {
    wire: {
      type: 'doc_ops_result',
      data: {
        v: 1,
        workflow_id: 'wf-1',
        ok: false,
        seq: 8,
        applied: ['op-1'],
        skipped: ['op-3'],
        failed: { index: 1, op_id: 'op-2', code: 'invalid', message: 'bad op' }
      }
    },
    expected: {
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: false,
        seq: 8,
        applied: ['op-1'],
        skipped: ['op-3'],
        failed: {
          index: 1,
          op_id: 'op-2',
          code: 'invalid',
          message: 'bad op'
        }
      }
    }
  }
]

describe('doc frame wire contract', () => {
  it.for(representativeFrames)(
    'adapts representative generated $wire.type frames without losing payload fields',
    ({ wire, expected }) => {
      const generatedFrame = zServerDocFrame.parse(wire)

      expect(parseServerDocFrame(generatedFrame)).toEqual(expected)
    }
  )

  it.for(['not base64!', 'AQE', 'AQ==    ', 'AQB=', 'AR=='])(
    'rejects update_b64 %j, which the wire schema admits',
    (update_b64) => {
      const generatedFrame = zDocUpdateFrame.parse(docUpdateFrame(update_b64))

      expect(parseServerDocFrame(generatedFrame)).toBeNull()
    }
  )

  it.for([null, '', {}])('rejects empty external input %#', (value) => {
    expect(parseServerDocFrame(value)).toBeNull()
  })

  it('rejects a generated int64 sequence outside the frontend safe-integer domain', () => {
    const wire = docUpdateFrame(encodeBase64(Uint8Array.of(1)))
    const generatedFrame = zDocUpdateFrame.parse({
      ...wire,
      data: {
        ...wire.data,
        seq: BigInt(Number.MAX_SAFE_INTEGER) + 1n
      }
    })

    expect(parseServerDocFrame(generatedFrame)).toBeNull()
  })

  it('accepts a generated int64 sequence at the frontend safe-integer boundary', () => {
    const wire = docUpdateFrame(encodeBase64(Uint8Array.of(1)))
    const generatedFrame = zDocUpdateFrame.parse({
      ...wire,
      data: {
        ...wire.data,
        seq: BigInt(Number.MAX_SAFE_INTEGER)
      }
    })

    expect(parseServerDocFrame(generatedFrame)).toEqual({
      type: 'doc_update',
      data: {
        workflowId: 'wf-1',
        seq: Number.MAX_SAFE_INTEGER,
        update: Uint8Array.of(1)
      }
    })
  })
})

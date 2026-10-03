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
    parsedType: 'doc_update'
  },
  {
    wire: {
      type: 'doc_reset',
      data: { v: 1, workflow_id: 'wf-1', seq: 7, lineage_seq: 2 }
    },
    parsedType: 'doc_reset'
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
    parsedType: 'doc_ops_result'
  }
]

describe('doc frame wire contract', () => {
  it.for(representativeFrames)(
    'parses representative generated $parsedType frames',
    ({ wire, parsedType }) => {
      expect(zServerDocFrame.safeParse(wire).success).toBe(true)
      expect(parseServerDocFrame(wire)).toMatchObject({ type: parsedType })
    }
  )

  it('maps the generated doc_ops_result failed field at the adapter boundary', () => {
    const frame = representativeFrames[2].wire

    expect(parseServerDocFrame(frame)).toEqual({
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
    })
  })

  it.for(['not base64!', 'AQE', 'AQ==    ', 'AQB=', 'AR=='])(
    'rejects update_b64 %j, which the wire schema admits',
    (update_b64) => {
      const frame = docUpdateFrame(update_b64)

      expect(zDocUpdateFrame.safeParse(frame).success).toBe(true)
      expect(parseServerDocFrame(frame)).toBeNull()
    }
  )
})

import { zDocUpdateFrame, zServerDocFrame } from '@comfyorg/ingest-types/zod'
import { describe, expect, it } from 'vitest'

import { encodeBase64, parseServerDocFrame } from './docFrameClient'

const docUpdateFrame = (update_b64: string) => ({
  type: 'doc_update',
  data: { v: 1, workflow_id: 'wf-1', seq: 1, update_b64 }
})

const wellFormedFrames = [
  docUpdateFrame(encodeBase64(Uint8Array.of(1, 2, 3))),
  { type: 'doc_reset', data: { v: 1, workflow_id: 'wf-1', seq: 7 } }
]

describe('doc frame wire contract', () => {
  it('parses every frame the authoritative ingest schema accepts', () => {
    for (const frame of wellFormedFrames) {
      expect(zServerDocFrame.safeParse(frame).success).toBe(true)
      expect(parseServerDocFrame(frame)).not.toBeNull()
    }
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

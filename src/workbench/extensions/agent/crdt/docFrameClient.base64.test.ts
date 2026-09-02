import { describe, expect, it } from 'vitest'

import { parseServerDocFrame } from './docFrameClient'

function docUpdate(updateB64: string): unknown {
  return {
    type: 'doc_update',
    data: {
      v: 1,
      workflow_id: 'workflow-1',
      seq: 1,
      update_b64: updateB64
    }
  }
}

describe('parseServerDocFrame doc_update base64 validation', () => {
  it('rejects non-base64 characters without throwing', () => {
    expect(() => parseServerDocFrame(docUpdate('YQ$='))).not.toThrow()
    expect(parseServerDocFrame(docUpdate('YQ$='))).toBeNull()
  })

  it('rejects truncated base64 without throwing', () => {
    expect(() => parseServerDocFrame(docUpdate('YQ='))).not.toThrow()
    expect(parseServerDocFrame(docUpdate('YQ='))).toBeNull()
  })

  it('rejects decoded updates larger than 8 MiB without throwing', () => {
    const encoded = 'AAAA'.repeat((8 * 1024 * 1024 + 1) / 3)

    expect(() => parseServerDocFrame(docUpdate(encoded))).not.toThrow()
    expect(parseServerDocFrame(docUpdate(encoded))).toBeNull()
  })

  it('rejects an empty update without throwing', () => {
    expect(() => parseServerDocFrame(docUpdate(''))).not.toThrow()
    expect(parseServerDocFrame(docUpdate(''))).toBeNull()
  })
})

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

  it('rejects non-canonical padding bits (RFC 4648 §3.5)', () => {
    // `YR==` and the canonical `YQ==` both decode to the same single byte
    // (0x61) because the low 4 unused pad bits are non-zero; accepting both
    // strings for one byte value is a malleability hole.
    expect(() => parseServerDocFrame(docUpdate('YR=='))).not.toThrow()
    expect(parseServerDocFrame(docUpdate('YR=='))).toBeNull()
  })

  it('accepts canonical padding for the same byte', () => {
    const parsed = parseServerDocFrame(docUpdate('YQ=='))
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('doc_update')
  })
})

import { describe, expect, it } from 'vitest'

import { docUpdateFrame } from './__fixtures__/docFrameClient'
import { parseServerDocFrame } from './docFrameClient'

const invalidBase64: [string, string][] = [
  ['non-base64 characters', 'YQ$='],
  ['truncated input', 'YQ='],
  ['empty input', ''],
  ['non-canonical padding bits (RFC 4648 §3.5)', 'YR==']
]

describe('parseServerDocFrame doc_update base64 validation', () => {
  it.for(invalidBase64)('rejects %s without throwing', ([_name, encoded]) => {
    expect(() =>
      parseServerDocFrame(docUpdateFrame({ update_b64: encoded }))
    ).not.toThrow()
    expect(
      parseServerDocFrame(docUpdateFrame({ update_b64: encoded }))
    ).toBeNull()
  })

  it('rejects decoded updates larger than 8 MiB without throwing', () => {
    const encoded = 'AAAA'.repeat((8 * 1024 * 1024 + 1) / 3)

    expect(() =>
      parseServerDocFrame(docUpdateFrame({ update_b64: encoded }))
    ).not.toThrow()
    expect(
      parseServerDocFrame(docUpdateFrame({ update_b64: encoded }))
    ).toBeNull()
  })

  it('accepts a decoded update at exactly 8 MiB', () => {
    const maxBytes = 8 * 1024 * 1024
    const encoded = 'AAAA'.repeat(Math.floor(maxBytes / 3)) + 'AAA='

    expect(
      parseServerDocFrame(docUpdateFrame({ update_b64: encoded }))
    ).not.toBeNull()
  })

  it('accepts canonical padding for the same byte', () => {
    const parsed = parseServerDocFrame(docUpdateFrame({ update_b64: 'YQ==' }))
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('doc_update')
  })
})

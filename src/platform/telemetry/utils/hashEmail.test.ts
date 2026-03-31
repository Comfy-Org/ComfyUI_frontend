import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { hashEmail, normalizeEmail } from './hashEmail'

function toUint8Array(data: BufferSource): Uint8Array {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }

  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

describe('hashEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes email addresses before hashing', () => {
    expect(normalizeEmail('  Test@Example.com  ')).toBe('test@example.com')
    expect(normalizeEmail('   ')).toBeUndefined()
    expect(normalizeEmail(undefined)).toBeUndefined()
  })

  it('hashes normalized email with SHA-256', async () => {
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(
          async (_algorithm: AlgorithmIdentifier, data: BufferSource) => {
            const digest = createHash('sha256')
              .update(toUint8Array(data))
              .digest()
            return Uint8Array.from(digest).buffer
          }
        )
      }
    })

    await expect(hashEmail('  Test@Example.com  ', 'SHA-256')).resolves.toBe(
      createHash('sha256').update('test@example.com').digest('hex')
    )
  })

  it('hashes normalized email with SHA-1', async () => {
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(
          async (_algorithm: AlgorithmIdentifier, data: BufferSource) => {
            const digest = createHash('sha1')
              .update(toUint8Array(data))
              .digest()
            return Uint8Array.from(digest).buffer
          }
        )
      }
    })

    await expect(hashEmail('  Test@Example.com  ', 'SHA-1')).resolves.toBe(
      createHash('sha1').update('test@example.com').digest('hex')
    )
  })

  it('returns undefined when hashing is unavailable', async () => {
    vi.stubGlobal('crypto', undefined)

    await expect(hashEmail('test@example.com', 'SHA-256')).resolves.toBe(
      undefined
    )
  })
})

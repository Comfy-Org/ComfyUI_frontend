import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { getFromPngFile } from './png'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const arbSignedBytes = fc
  .uint8Array({ minLength: 0, maxLength: 64 })
  .map((tail) => Uint8Array.from([...PNG_SIGNATURE, ...tail]))

describe('getFromPngFile settlement', () => {
  it('settles for any byte sequence behind a valid signature', async () => {
    await fc.assert(
      fc.asyncProperty(arbSignedBytes, async (bytes) => {
        const settled = await getFromPngFile(
          new File([bytes], 'fuzzed.png')
        ).then(
          () => 'resolved',
          () => 'rejected'
        )
        expect(settled).toMatch(/^(resolved|rejected)$/)
      }),
      { numRuns: 200 }
    )
  }, 30_000)
})

import { describe, expect, it } from 'vitest'
import {
  assertPackLedgerKeys,
  packLedgerFor
} from '@e2e/fixtures/customNode/packLedger'

const ledger = {
  'ComfyUI-VideoHelperSuite': {
    VHS_LoadVideo: 'pack-owned upload widget'
  }
}

describe('packLedgerFor', () => {
  it('matches cloud pack ids case-insensitively', () => {
    expect(packLedgerFor(ledger, 'comfyui-videohelpersuite')).toEqual(
      ledger['ComfyUI-VideoHelperSuite']
    )
  })

  it('returns an empty ledger for an unknown pack', () => {
    expect(packLedgerFor(ledger, 'Other-Pack')).toEqual({})
  })

  it('rejects ambiguous folded keys', () => {
    expect(() =>
      packLedgerFor(
        {
          Example: { NodeA: 'first' },
          example: { NodeB: 'second' }
        },
        'EXAMPLE'
      )
    ).toThrow(/duplicate case-insensitive keys.*Example, example/)
  })
})

describe('assertPackLedgerKeys', () => {
  it('accepts a differently-cased manifest key', () => {
    expect(() =>
      assertPackLedgerKeys('ROUNDTRIP_VALUE_ALLOWLIST', ledger, [
        'comfyui-videohelpersuite'
      ])
    ).not.toThrow()
  })

  it('rejects a ledger pack absent from the manifest', () => {
    expect(() =>
      assertPackLedgerKeys('ROUNDTRIP_VALUE_ALLOWLIST', ledger, ['Other-Pack'])
    ).toThrow(
      /ROUNDTRIP_VALUE_ALLOWLIST.*not in manifest: ComfyUI-VideoHelperSuite/
    )
  })

  it('rejects duplicate case-insensitive ledger keys', () => {
    expect(() =>
      assertPackLedgerKeys(
        'ROUNDTRIP_VALUE_ALLOWLIST',
        {
          Example: { NodeA: 'first' },
          example: { NodeB: 'second' }
        },
        ['example']
      )
    ).toThrow(/case-insensitive duplicates: example/)
  })
})

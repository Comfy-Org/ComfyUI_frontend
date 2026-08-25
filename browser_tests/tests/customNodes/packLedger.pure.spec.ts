import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  assertPackLedgerKeys,
  packLedgerFor
} from '@e2e/fixtures/customNode/packLedger'

const ledger = {
  'ComfyUI-VideoHelperSuite': {
    VHS_LoadVideo: 'pack-owned upload widget'
  }
}

test.describe('packLedgerFor', () => {
  test('matches cloud pack ids case-insensitively', () => {
    expect(packLedgerFor(ledger, 'comfyui-videohelpersuite')).toEqual(
      ledger['ComfyUI-VideoHelperSuite']
    )
  })

  test('returns an empty ledger for an unknown pack', () => {
    expect(packLedgerFor(ledger, 'Other-Pack')).toEqual({})
  })

  test('rejects ambiguous folded keys', () => {
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

test.describe('assertPackLedgerKeys', () => {
  test('accepts a differently-cased manifest key', () => {
    expect(() =>
      assertPackLedgerKeys('ROUNDTRIP_VALUE_ALLOWLIST', ledger, [
        'comfyui-videohelpersuite'
      ])
    ).not.toThrow()
  })

  test('rejects a ledger pack absent from the manifest', () => {
    expect(() =>
      assertPackLedgerKeys('ROUNDTRIP_VALUE_ALLOWLIST', ledger, ['Other-Pack'])
    ).toThrow(
      /ROUNDTRIP_VALUE_ALLOWLIST.*not in manifest: ComfyUI-VideoHelperSuite/
    )
  })

  test('rejects duplicate case-insensitive ledger keys', () => {
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

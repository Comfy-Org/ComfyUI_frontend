import { describe, expect, it } from 'vitest'

import type { AssetUserMetadata } from '@/platform/assets/schemas/assetSchema'

import { isReservedUserMetadataKey } from './assetUserMetadataReservedKeys'
import {
  DEFAULT_USER_METADATA_JSON_PREVIEW_MAX,
  mergeUserMetadataForAssetPut,
  parseUserMetadataForEditor,
  truncateJsonPreview,
  validateCustomMetadataKey
} from './assetUserMetadataEditorUtils'

describe('isReservedUserMetadataKey', () => {
  it('treats model and output keys as reserved', () => {
    expect(isReservedUserMetadataKey('name')).toBe(true)
    expect(isReservedUserMetadataKey('jobId')).toBe(true)
    expect(isReservedUserMetadataKey('seed')).toBe(false)
  })
})

describe('validateCustomMetadataKey', () => {
  it('accepts valid identifiers', () => {
    expect(validateCustomMetadataKey('seed')).toEqual({ ok: true })
    expect(validateCustomMetadataKey('_x')).toEqual({ ok: true })
  })

  it('rejects empty and whitespace', () => {
    expect(validateCustomMetadataKey('')).toEqual({
      ok: false,
      issue: 'empty'
    })
    expect(validateCustomMetadataKey('   ')).toEqual({
      ok: false,
      issue: 'empty'
    })
  })

  it('rejects reserved keys', () => {
    expect(validateCustomMetadataKey('name')).toEqual({
      ok: false,
      issue: 'reserved'
    })
  })

  it('rejects invalid format', () => {
    expect(validateCustomMetadataKey('9abc')).toEqual({
      ok: false,
      issue: 'invalid_format'
    })
    expect(validateCustomMetadataKey('a-b')).toEqual({
      ok: false,
      issue: 'invalid_format'
    })
  })

  it('rejects overly long keys', () => {
    const long = `a${'b'.repeat(64)}`
    expect(validateCustomMetadataKey(long)).toEqual({
      ok: false,
      issue: 'max_length'
    })
  })
})

describe('truncateJsonPreview', () => {
  it('returns compact JSON for small values', () => {
    expect(truncateJsonPreview({ a: 1 })).toBe('{"a":1}')
  })

  it('truncates long JSON', () => {
    const big = { x: 'y'.repeat(500) }
    const out = truncateJsonPreview(big, 40)
    expect(out.length).toBeLessThanOrEqual(40)
    expect(out.endsWith('…')).toBe(true)
  })

  it('uses default max length', () => {
    const huge = {
      data: 'z'.repeat(DEFAULT_USER_METADATA_JSON_PREVIEW_MAX * 2)
    }
    const out = truncateJsonPreview(huge)
    expect(out.length).toBeLessThanOrEqual(
      DEFAULT_USER_METADATA_JSON_PREVIEW_MAX
    )
  })
})

describe('parseUserMetadataForEditor', () => {
  it('splits custom primitives, system primitives, and unsupported', () => {
    const parsed = parseUserMetadataForEditor({
      seed: 42,
      name: 'Model',
      extra: { nested: true },
      tags: ['a'],
      flag: false
    })
    expect(parsed.customPrimitives).toEqual([
      expect.objectContaining({
        kind: 'customPrimitive',
        key: 'flag',
        primitiveType: 'boolean',
        value: false
      }),
      expect.objectContaining({
        kind: 'customPrimitive',
        key: 'seed',
        primitiveType: 'number',
        value: 42
      })
    ])
    expect(parsed.systemPrimitives).toEqual([
      expect.objectContaining({
        kind: 'systemReadOnly',
        key: 'name',
        primitiveType: 'string',
        value: 'Model'
      })
    ])
    expect(parsed.unsupported).toEqual([
      expect.objectContaining({ kind: 'unsupported', key: 'extra' }),
      expect.objectContaining({ kind: 'unsupported', key: 'tags' })
    ])
  })

  it('treats NaN as unsupported', () => {
    const parsed = parseUserMetadataForEditor({ bad: Number.NaN })
    expect(parsed.customPrimitives).toHaveLength(0)
    expect(parsed.unsupported).toHaveLength(1)
    expect(parsed.unsupported[0].key).toBe('bad')
  })

  it('handles undefined metadata', () => {
    expect(parseUserMetadataForEditor(undefined)).toEqual({
      customPrimitives: [],
      systemPrimitives: [],
      unsupported: []
    })
  })
})

describe('mergeUserMetadataForAssetPut', () => {
  const modelPatch: AssetUserMetadata = { user_description: 'hello' }

  it('merges base, model panel, and custom patches', () => {
    const out = mergeUserMetadataForAssetPut(
      { seed: 1, name: 'A' },
      modelPatch,
      { caption: 'x' },
      new Set()
    )
    expect(out).toEqual({
      seed: 1,
      name: 'A',
      user_description: 'hello',
      caption: 'x'
    })
  })

  it('removes only non-reserved keys listed for delete', () => {
    const out = mergeUserMetadataForAssetPut(
      { seed: 1, name: 'Keep' },
      {},
      {},
      new Set(['seed', 'name'])
    )
    expect(out).toEqual({ name: 'Keep' })
  })

  it('does not delete reserved keys via custom delete set', () => {
    const out = mergeUserMetadataForAssetPut(
      { jobId: 'j1' },
      {},
      {},
      new Set(['jobId'])
    )
    expect(out).toEqual({ jobId: 'j1' })
  })

  it('ignores custom patches for reserved keys', () => {
    const out = mergeUserMetadataForAssetPut(
      { name: 'Server' },
      {},
      { name: 'Hijack' } as Record<string, string | number | boolean>,
      new Set()
    )
    expect(out.name).toBe('Server')
  })

  it('preserves unrelated keys when updating a custom field', () => {
    const out = mergeUserMetadataForAssetPut(
      {
        name: 'N',
        base_model: ['SDXL'],
        caption: 'old',
        other: { nested: true }
      },
      {},
      { caption: 'new' },
      new Set()
    )
    expect(out.name).toBe('N')
    expect(out.base_model).toEqual(['SDXL'])
    expect(out.caption).toBe('new')
    expect(out.other).toEqual({ nested: true })
  })
})

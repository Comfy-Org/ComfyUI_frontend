import { describe, expect, it } from 'vitest'

import type { AssetUserMetadata } from '@/platform/assets/schemas/assetSchema'

import {
  DEFAULT_USER_METADATA_JSON_PREVIEW_MAX,
  mergeUserMetadataForAssetPut,
  parseUserMetadataForEditor,
  truncateJsonPreview,
  USER_METADATA_CUSTOM_KEY,
  validateCustomMetadataKey
} from './assetUserMetadataEditorUtils'

describe('validateCustomMetadataKey', () => {
  it('accepts valid identifiers including names that overlap top-level keys', () => {
    expect(validateCustomMetadataKey('seed')).toEqual({ ok: true })
    expect(validateCustomMetadataKey('name')).toEqual({ ok: true })
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
  it('reads only user_metadata.custom primitives and unsupported entries', () => {
    const parsed = parseUserMetadataForEditor({
      seed: 42,
      name: 'Model',
      [USER_METADATA_CUSTOM_KEY]: {
        flag: false,
        caption: 'x',
        extra: { nested: true },
        tags: ['a'],
        nanish: Number.NaN
      }
    })
    expect(parsed.customBucketState).toBe('valid')
    expect(parsed.customPrimitives).toEqual([
      expect.objectContaining({
        kind: 'customPrimitive',
        key: 'caption',
        primitiveType: 'string',
        value: 'x'
      }),
      expect.objectContaining({
        kind: 'customPrimitive',
        key: 'flag',
        primitiveType: 'boolean',
        value: false
      })
    ])
    expect(parsed.unsupportedInCustom.map((r) => r.key).sort()).toEqual([
      'extra',
      'nanish',
      'tags'
    ])
  })

  it('treats top-level primitives as ignored for custom editor', () => {
    const parsed = parseUserMetadataForEditor({
      seed: 1,
      name: 'N'
    })
    expect(parsed.customBucketState).toBe('missing')
    expect(parsed.customPrimitives).toHaveLength(0)
    expect(parsed.unsupportedInCustom).toHaveLength(0)
  })

  it('treats NaN inside custom as unsupported', () => {
    const parsed = parseUserMetadataForEditor({
      [USER_METADATA_CUSTOM_KEY]: { bad: Number.NaN }
    })
    expect(parsed.customPrimitives).toHaveLength(0)
    expect(parsed.unsupportedInCustom).toHaveLength(1)
    expect(parsed.unsupportedInCustom[0].key).toBe('bad')
  })

  it('treats missing custom as missing bucket', () => {
    expect(parseUserMetadataForEditor(undefined)).toMatchObject({
      customPrimitives: [],
      unsupportedInCustom: [],
      customBucketState: 'missing'
    })
    expect(parseUserMetadataForEditor({})).toMatchObject({
      customBucketState: 'missing'
    })
  })

  it('treats non-object custom as invalid', () => {
    const parsed = parseUserMetadataForEditor({
      [USER_METADATA_CUSTOM_KEY]: 'oops'
    })
    expect(parsed.customBucketState).toBe('invalid')
    expect(parsed.invalidCustomPreview).toBe('"oops"')
    expect(parsed.customPrimitives).toHaveLength(0)
  })

  it('treats null custom as invalid', () => {
    const parsed = parseUserMetadataForEditor({
      [USER_METADATA_CUSTOM_KEY]: null
    })
    expect(parsed.customBucketState).toBe('invalid')
  })
})

describe('mergeUserMetadataForAssetPut', () => {
  const modelPatch: AssetUserMetadata = { user_description: 'hello' }

  it('does not add custom when there are no custom mutations', () => {
    const out = mergeUserMetadataForAssetPut(
      { seed: 1, name: 'A' },
      modelPatch,
      {},
      new Set()
    )
    expect(out).toEqual({
      seed: 1,
      name: 'A',
      user_description: 'hello'
    })
  })

  it('merges custom subtree and preserves other top-level keys', () => {
    const out = mergeUserMetadataForAssetPut(
      { seed: 1, name: 'A', jobId: 'j' },
      modelPatch,
      { caption: 'x' },
      new Set()
    )
    expect(out).toEqual({
      seed: 1,
      name: 'A',
      jobId: 'j',
      user_description: 'hello',
      [USER_METADATA_CUSTOM_KEY]: { caption: 'x' }
    })
  })

  it('sets custom to empty object when last primitive key is deleted', () => {
    const out = mergeUserMetadataForAssetPut(
      {
        name: 'N',
        [USER_METADATA_CUSTOM_KEY]: { only: 1 }
      },
      {},
      {},
      new Set(['only'])
    )
    expect(out[USER_METADATA_CUSTOM_KEY]).toEqual({})
    expect(out.name).toBe('N')
  })

  it('treats invalid custom as empty and still applies patches', () => {
    const out = mergeUserMetadataForAssetPut(
      { [USER_METADATA_CUSTOM_KEY]: 'broken', name: 'Keep' },
      {},
      { caption: 'x' },
      new Set()
    )
    expect(out[USER_METADATA_CUSTOM_KEY]).toEqual({ caption: 'x' })
    expect(out.name).toBe('Keep')
  })

  it('treats invalid custom as empty and still applies delete keys', () => {
    const out = mergeUserMetadataForAssetPut(
      { [USER_METADATA_CUSTOM_KEY]: ['a'], name: 'Keep' },
      {},
      {},
      new Set(['stale'])
    )
    expect(out[USER_METADATA_CUSTOM_KEY]).toEqual({})
    expect(out.name).toBe('Keep')
  })

  it('writes patches under custom without changing top-level name', () => {
    const out = mergeUserMetadataForAssetPut(
      { name: 'Server' },
      {},
      { name: 'InsideCustom' },
      new Set()
    )
    expect(out.name).toBe('Server')
    expect(out[USER_METADATA_CUSTOM_KEY]).toEqual({ name: 'InsideCustom' })
  })

  it('preserves unsupported keys inside custom when patching primitives', () => {
    const out = mergeUserMetadataForAssetPut(
      {
        [USER_METADATA_CUSTOM_KEY]: {
          caption: 'old',
          blob: { nested: true }
        }
      },
      {},
      { caption: 'new' },
      new Set()
    )
    expect(out[USER_METADATA_CUSTOM_KEY]).toEqual({
      caption: 'new',
      blob: { nested: true }
    })
  })

  it('preserves unrelated top-level keys when updating custom', () => {
    const out = mergeUserMetadataForAssetPut(
      {
        name: 'N',
        base_model: ['SDXL'],
        other: { nested: true },
        [USER_METADATA_CUSTOM_KEY]: { caption: 'old' }
      },
      {},
      { caption: 'new' },
      new Set()
    )
    expect(out.name).toBe('N')
    expect(out.base_model).toEqual(['SDXL'])
    expect(out.other).toEqual({ nested: true })
    expect(out[USER_METADATA_CUSTOM_KEY]).toEqual({ caption: 'new' })
  })

  it('deletes keys inside custom including jobId as a custom sub-key', () => {
    const out = mergeUserMetadataForAssetPut(
      {
        jobId: 'top',
        [USER_METADATA_CUSTOM_KEY]: { jobId: 'inner', x: 1 }
      },
      {},
      {},
      new Set(['jobId'])
    )
    expect(out.jobId).toBe('top')
    expect(out[USER_METADATA_CUSTOM_KEY]).toEqual({ x: 1 })
  })
})

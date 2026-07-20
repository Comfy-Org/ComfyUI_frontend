import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  MISSING_TAG,
  MODELS_TAG
} from '@/platform/assets/services/assetService'
import {
  buildModelTypeTagUpdate,
  getAssetAdditionalTags,
  getAssetBaseModel,
  getAssetBaseModels,
  getAssetCardTitle,
  getAssetCategories,
  getAssetDescription,
  getAssetDisplayFilename,
  getAssetDisplayName,
  getAssetFilename,
  getAssetMetadataDimensions,
  getAssetModelType,
  getAssetNodeCategoryCandidates,
  getAssetSourceUrl,
  getPrimaryCategoryTag,
  getAssetStoredFilename,
  getAssetTriggerPhrases,
  getAssetTypeBadges,
  getAssetUserDescription,
  getEditableModelType,
  getSourceName,
  resolveDisplayImageDimensions,
  stripModelTypePrefix,
  toModelTypeTag
} from '@/platform/assets/utils/assetMetadataUtils'

const { isCloudRef } = vi.hoisted(() => ({
  isCloudRef: { value: true }
}))

vi.mock('@/platform/distribution/types', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get isCloud() {
    return isCloudRef.value
  }
}))

describe('assetMetadataUtils', () => {
  const mockAsset: AssetItem = {
    id: 'test-id',
    name: 'test-model',
    hash: 'hash123',
    size: 1024,
    mime_type: 'application/octet-stream',
    tags: ['models', 'checkpoints'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_access_time: '2024-01-01T00:00:00Z'
  }

  describe('getAssetDescription', () => {
    it.for([
      {
        name: 'returns string description when present',
        description: 'A test model',
        expected: 'A test model'
      },
      { name: 'returns null for non-string', description: 123, expected: null },
      { name: 'returns null for null', description: null, expected: null }
    ])('$name', ({ description, expected }) => {
      const asset = { ...mockAsset, user_metadata: { description } }
      expect(getAssetDescription(asset)).toBe(expected)
    })

    it('should return null when no metadata', () => {
      expect(getAssetDescription(mockAsset)).toBeNull()
    })
  })

  describe('getAssetBaseModel', () => {
    it.for([
      {
        name: 'returns string base_model when present',
        base_model: 'SDXL',
        expected: 'SDXL'
      },
      { name: 'returns null for non-string', base_model: 123, expected: null },
      { name: 'returns null for null', base_model: null, expected: null }
    ])('$name', ({ base_model, expected }) => {
      const asset = { ...mockAsset, user_metadata: { base_model } }
      expect(getAssetBaseModel(asset)).toBe(expected)
    })

    it('should return null when no metadata', () => {
      expect(getAssetBaseModel(mockAsset)).toBeNull()
    })
  })

  describe('getAssetDisplayName', () => {
    it.for([
      {
        name: 'returns name from user_metadata when present',
        user_metadata: { name: 'My Custom Name' },
        display_name: 'ComfyUI_00001_.png',
        expected: 'My Custom Name'
      },
      {
        name: 'returns display_name when user_metadata.name is absent',
        user_metadata: undefined,
        display_name: 'ComfyUI_00001_.png',
        expected: 'ComfyUI_00001_.png'
      },
      {
        name: 'falls back to asset name when both are absent',
        user_metadata: undefined,
        display_name: undefined,
        expected: 'test-model'
      },
      {
        name: 'skips non-string user_metadata.name',
        user_metadata: { name: 123 },
        display_name: 'ComfyUI_00001_.png',
        expected: 'ComfyUI_00001_.png'
      },
      {
        name: 'falls back to asset name when display_name is empty',
        user_metadata: undefined,
        display_name: '',
        expected: 'test-model'
      }
    ])('$name', ({ user_metadata, display_name, expected }) => {
      const asset = { ...mockAsset, user_metadata, display_name }
      expect(getAssetDisplayName(asset)).toBe(expected)
    })
  })

  describe('getAssetSourceUrl', () => {
    it.for([
      {
        name: 'constructs URL from civitai format',
        source_arn: 'civitai:model:123:version:456',
        expected: 'https://civitai.com/models/123?modelVersionId=456'
      },
      { name: 'returns null for non-string', source_arn: 123, expected: null },
      {
        name: 'returns null for unrecognized format',
        source_arn: 'unknown:format',
        expected: null
      }
    ])('$name', ({ source_arn, expected }) => {
      const asset = { ...mockAsset, user_metadata: { source_arn } }
      expect(getAssetSourceUrl(asset)).toBe(expected)
    })

    it('should return null when no metadata', () => {
      expect(getAssetSourceUrl(mockAsset)).toBeNull()
    })
  })

  describe('getAssetTriggerPhrases', () => {
    it.for([
      {
        name: 'returns array when array present',
        trained_words: ['phrase1', 'phrase2'],
        expected: ['phrase1', 'phrase2']
      },
      {
        name: 'wraps single string in array',
        trained_words: 'single phrase',
        expected: ['single phrase']
      },
      {
        name: 'filters non-string values from array',
        trained_words: ['valid', 123, 'also valid', null],
        expected: ['valid', 'also valid']
      }
    ])('$name', ({ trained_words, expected }) => {
      const asset = { ...mockAsset, user_metadata: { trained_words } }
      expect(getAssetTriggerPhrases(asset)).toEqual(expected)
    })

    it('should return empty array when no metadata', () => {
      expect(getAssetTriggerPhrases(mockAsset)).toEqual([])
    })
  })

  describe('getAssetAdditionalTags', () => {
    it.for([
      {
        name: 'returns array of tags when present',
        additional_tags: ['tag1', 'tag2'],
        expected: ['tag1', 'tag2']
      },
      {
        name: 'filters non-string values from array',
        additional_tags: ['valid', 123, 'also valid'],
        expected: ['valid', 'also valid']
      },
      {
        name: 'returns empty array for non-array',
        additional_tags: 'not an array',
        expected: []
      }
    ])('$name', ({ additional_tags, expected }) => {
      const asset = { ...mockAsset, user_metadata: { additional_tags } }
      expect(getAssetAdditionalTags(asset)).toEqual(expected)
    })

    it('should return empty array when no metadata', () => {
      expect(getAssetAdditionalTags(mockAsset)).toEqual([])
    })
  })

  describe('getSourceName', () => {
    it.for([
      {
        name: 'returns Civitai for civitai.com',
        url: 'https://civitai.com/models/123',
        expected: 'Civitai'
      },
      {
        name: 'returns Civitai for civitai.red',
        url: 'https://civitai.red/models/123',
        expected: 'Civitai'
      },
      {
        name: 'returns Hugging Face for huggingface.co',
        url: 'https://huggingface.co/org/model',
        expected: 'Hugging Face'
      },
      {
        name: 'returns Source for unknown URLs',
        url: 'https://example.com/model',
        expected: 'Source'
      }
    ])('$name', ({ url, expected }) => {
      expect(getSourceName(url)).toBe(expected)
    })
  })

  describe('getAssetBaseModels', () => {
    it.for([
      {
        name: 'array of strings',
        base_model: ['SDXL', 'SD1.5', 'Flux'],
        expected: ['SDXL', 'SD1.5', 'Flux']
      },
      {
        name: 'filters non-string entries',
        base_model: ['SDXL', 123, 'SD1.5', null, undefined],
        expected: ['SDXL', 'SD1.5']
      },
      {
        name: 'single string wrapped in array',
        base_model: 'SDXL',
        expected: ['SDXL']
      },
      {
        name: 'non-array/string returns empty',
        base_model: 123,
        expected: []
      },
      { name: 'undefined returns empty', base_model: undefined, expected: [] }
    ])('$name', ({ base_model, expected }) => {
      const asset = { ...mockAsset, user_metadata: { base_model } }
      expect(getAssetBaseModels(asset)).toEqual(expected)
    })

    it('should return empty array when no metadata', () => {
      expect(getAssetBaseModels(mockAsset)).toEqual([])
    })
  })

  describe('getAssetModelType', () => {
    it.for([
      {
        name: 'returns model type from tags',
        tags: ['models', 'checkpoints'],
        expected: 'checkpoints'
      },
      {
        name: 'returns full path for path-style tags',
        tags: ['models', 'diffusers/Kolors/text_encoder'],
        expected: 'diffusers/Kolors/text_encoder'
      },
      {
        name: 'returns null when only models tag',
        tags: ['models'],
        expected: null
      },
      { name: 'returns null when tags empty', tags: [], expected: null },
      {
        name: 'never returns a raw model_type: literal (no round-trip into edit widgets)',
        tags: ['models', 'model_type:checkpoints'],
        expected: null
      },
      {
        name: 'skips model_type: tags in favour of the bare twin',
        tags: ['models', 'model_type:checkpoints', 'checkpoints'],
        expected: 'checkpoints'
      }
    ])('$name', ({ tags, expected }) => {
      const asset = { ...mockAsset, tags }
      expect(getAssetModelType(asset)).toBe(expected)
    })
  })

  describe('getAssetUserDescription', () => {
    it.for([
      {
        name: 'returns description when present',
        user_description: 'A custom user description',
        expected: 'A custom user description'
      },
      {
        name: 'returns empty for non-string',
        user_description: 123,
        expected: ''
      },
      { name: 'returns empty for null', user_description: null, expected: '' },
      {
        name: 'returns empty for undefined',
        user_description: undefined,
        expected: ''
      }
    ])('$name', ({ user_description, expected }) => {
      const asset = { ...mockAsset, user_metadata: { user_description } }
      expect(getAssetUserDescription(asset)).toBe(expected)
    })

    it('should return empty string when no metadata', () => {
      expect(getAssetUserDescription(mockAsset)).toBe('')
    })
  })

  describe('getAssetStoredFilename', () => {
    afterEach(() => {
      isCloudRef.value = true
    })

    it('returns the content hash on cloud when present', () => {
      isCloudRef.value = true
      expect(getAssetStoredFilename(mockAsset)).toBe('hash123')
    })

    it('falls back to name on cloud when no hash is present', () => {
      isCloudRef.value = true
      const asset = { ...mockAsset, hash: undefined }
      expect(getAssetStoredFilename(asset)).toBe('test-model')
    })

    it('returns name on OSS regardless of hash', () => {
      isCloudRef.value = false
      expect(getAssetStoredFilename(mockAsset)).toBe('test-model')
    })
  })

  describe('getAssetFilename', () => {
    it('returns user_metadata.filename when present', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { filename: 'from_user.png' },
        metadata: { filename: 'from_meta.png' },
        display_name: 'from_display.png'
      }
      expect(getAssetFilename(asset)).toBe('from_user.png')
    })

    it('falls through to metadata.filename then asset.name (never display_name)', () => {
      const asset = {
        ...mockAsset,
        user_metadata: {},
        metadata: {},
        display_name: 'from_display.png'
      }
      expect(getAssetFilename(asset)).toBe(mockAsset.name)
    })
  })

  describe('getAssetDisplayFilename', () => {
    it('prefers user_metadata.filename over everything else', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { filename: 'from_user.png' },
        metadata: { filename: 'from_meta.png' },
        display_name: 'from_display.png'
      }
      expect(getAssetDisplayFilename(asset)).toBe('from_user.png')
    })

    it('falls back to display_name when filename metadata is absent', () => {
      const asset = {
        ...mockAsset,
        user_metadata: {},
        metadata: {},
        display_name: 'ComfyUI_00001_.png'
      }
      expect(getAssetDisplayFilename(asset)).toBe('ComfyUI_00001_.png')
    })

    it('falls back to asset.name when neither filename metadata nor display_name exist', () => {
      expect(getAssetDisplayFilename(mockAsset)).toBe(mockAsset.name)
    })
  })

  describe('getAssetCardTitle', () => {
    it('returns user_metadata.name when it differs from asset.name', () => {
      const asset = {
        ...mockAsset,
        name: 'lora_v1.safetensors',
        user_metadata: { name: 'My Favorite LoRA' },
        metadata: { filename: 'lora_v1.safetensors' }
      }
      expect(getAssetCardTitle(asset)).toBe('My Favorite LoRA')
    })

    it('returns metadata.name when user_metadata.name is absent and it differs from asset.name', () => {
      const asset = {
        ...mockAsset,
        name: 'model_file.safetensors',
        metadata: { name: 'Curated Model' }
      }
      expect(getAssetCardTitle(asset)).toBe('Curated Model')
    })

    it('falls through to the filename helper when curated name equals asset.name (hash case)', () => {
      const HASH = 'blake3:abc'
      const asset = {
        ...mockAsset,
        name: HASH,
        user_metadata: { name: HASH },
        metadata: { filename: 'sunset.png' }
      }
      expect(getAssetCardTitle(asset)).toBe('sunset.png')
    })

    it('falls through to display_name when neither curated name nor filename metadata exist', () => {
      const asset = {
        ...mockAsset,
        name: 'hash.png',
        display_name: 'pretty.png'
      }
      expect(getAssetCardTitle(asset)).toBe('pretty.png')
    })
  })

  describe('unified asset response shape (BE-808 RFC)', () => {
    // Cloud asset: `asset.name` is a content hash; `display_name` carries
    // the user-facing label.
    const cloudShape: AssetItem = {
      ...mockAsset,
      id: 'cloud-asset-id',
      name: 'blake3:abc1234567890def.png',
      hash: 'blake3:abc1234567890def.png',
      display_name: 'sunset.png'
    }

    // OSS asset: `asset.name` is already the filename; `display_name` is
    // nullable per BE-1045 spec — clients fall back to `asset.name`.
    const ossShape: AssetItem = {
      ...mockAsset,
      id: 'oss-asset-id',
      name: 'sunset.png',
      hash: null,
      display_name: undefined
    }

    it('renders the same label for the Cloud and OSS shapes via getAssetDisplayFilename', () => {
      expect(getAssetDisplayFilename(cloudShape)).toBe('sunset.png')
      expect(getAssetDisplayFilename(ossShape)).toBe('sunset.png')
    })

    it('renders the same label via getAssetCardTitle', () => {
      expect(getAssetCardTitle(cloudShape)).toBe('sunset.png')
      expect(getAssetCardTitle(ossShape)).toBe('sunset.png')
    })

    it('honours OSS-emitted display_name when present', () => {
      const ossWithDisplayName: AssetItem = {
        ...ossShape,
        display_name: 'Curated Sunset'
      }
      expect(getAssetDisplayFilename(ossWithDisplayName)).toBe('Curated Sunset')
    })
  })

  describe('getAssetMetadataDimensions', () => {
    it('returns dimensions when width/height are positive integers', () => {
      const asset = { ...mockAsset, metadata: { width: 1024, height: 768 } }
      expect(getAssetMetadataDimensions(asset)).toEqual({
        width: 1024,
        height: 768
      })
    })

    it.for([
      { name: 'NaN width', width: Number.NaN, height: 768 },
      {
        name: 'Infinity height',
        width: 1024,
        height: Number.POSITIVE_INFINITY
      },
      { name: 'zero width', width: 0, height: 768 },
      { name: 'negative height', width: 1024, height: -1 },
      { name: 'fractional width', width: 1024.5, height: 768 },
      { name: 'string width', width: '1024', height: 768 },
      { name: 'missing width', width: undefined, height: 768 }
    ])('returns undefined for invalid shape: $name', ({ width, height }) => {
      const asset = { ...mockAsset, metadata: { width, height } }
      expect(getAssetMetadataDimensions(asset)).toBeUndefined()
    })

    it('returns undefined when metadata is absent', () => {
      expect(getAssetMetadataDimensions(mockAsset)).toBeUndefined()
    })

    it('returns undefined when asset itself is undefined', () => {
      expect(getAssetMetadataDimensions(undefined)).toBeUndefined()
    })
  })

  describe('resolveDisplayImageDimensions', () => {
    const rendered = { width: 512, height: 288 }

    it('prefers server metadata dimensions over the rendered natural size', () => {
      const asset = { ...mockAsset, metadata: { width: 1920, height: 1080 } }
      expect(resolveDisplayImageDimensions(asset, rendered)).toEqual({
        width: 1920,
        height: 1080
      })
    })

    it('prefers metadata even when a downscaled thumbnail was rendered', () => {
      const asset = {
        ...mockAsset,
        thumbnail_url: 'https://cdn.example/thumb.webp?res=512',
        preview_url: 'https://cdn.example/original.webp',
        metadata: { width: 1920, height: 1080 }
      }
      expect(resolveDisplayImageDimensions(asset, rendered)).toEqual({
        width: 1920,
        height: 1080
      })
    })

    it('falls back to the rendered natural size when no thumbnail was shown (original served)', () => {
      const asset = { ...mockAsset }
      expect(resolveDisplayImageDimensions(asset, rendered)).toEqual(rendered)
    })

    it('falls back to the rendered natural size on OSS where thumbnail_url equals preview_url (full-res)', () => {
      const fullResUrl =
        'http://localhost:8188/view?filename=output.png&type=output'
      const asset = {
        ...mockAsset,
        thumbnail_url: fullResUrl,
        preview_url: fullResUrl
      }
      expect(resolveDisplayImageDimensions(asset, rendered)).toEqual(rendered)
    })

    it('returns undefined (no label) when metadata is absent and a distinct downscaled thumbnail was rendered', () => {
      const asset = {
        ...mockAsset,
        thumbnail_url: 'https://cdn.example/thumb.webp?res=512',
        preview_url: 'https://cdn.example/original.webp'
      }
      expect(resolveDisplayImageDimensions(asset, rendered)).toBeUndefined()
    })

    it('suppresses the fallback for an invalid metadata shape when a distinct thumbnail was rendered', () => {
      const asset = {
        ...mockAsset,
        thumbnail_url: 'https://cdn.example/thumb.webp?res=512',
        preview_url: 'https://cdn.example/original.webp',
        metadata: { width: 0, height: 1080 }
      }
      expect(resolveDisplayImageDimensions(asset, rendered)).toBeUndefined()
    })

    it('suppresses the fallback when thumbnail_url is present but preview_url is absent', () => {
      const asset = {
        ...mockAsset,
        thumbnail_url: 'https://cdn.example/thumb.webp'
      }
      expect(resolveDisplayImageDimensions(asset, rendered)).toBeUndefined()
    })

    it('falls back to the rendered natural size when metadata is invalid and no thumbnail guard applies', () => {
      const asset = { ...mockAsset, metadata: { width: 0, height: 1080 } }
      expect(resolveDisplayImageDimensions(asset, rendered)).toEqual(rendered)
    })

    it('returns undefined when neither metadata nor a rendered size is available', () => {
      expect(
        resolveDisplayImageDimensions(mockAsset, undefined)
      ).toBeUndefined()
    })

    it('returns the rendered size when asset is undefined (no thumbnail to guard against)', () => {
      expect(resolveDisplayImageDimensions(undefined, rendered)).toEqual(
        rendered
      )
    })
  })
})

describe('getAssetCategories', () => {
  const asset = (tags: string[]): AssetItem => ({
    id: 'a',
    name: 'model.safetensors',
    tags
  })

  it('uses model_type:* values as the group and disregards other tags in model_type mode', () => {
    expect(
      getAssetCategories(
        asset(['models', 'model_type:checkpoints', 'sdxl']),
        true
      )
    ).toEqual(['checkpoints'])
  })

  it('preserves the model_type value casing', () => {
    expect(
      getAssetCategories(asset(['models', 'model_type:LLM']), true)
    ).toEqual(['LLM'])
  })

  it('routes an uncovered asset by its bare tags in model_type mode', () => {
    expect(getAssetCategories(asset(['models', 'checkpoints']), true)).toEqual([
      'checkpoints'
    ])
  })

  it('ignores model_type: and uses bare-tag grouping when mode is off', () => {
    expect(
      getAssetCategories(
        asset(['models', 'model_type:checkpoints', 'sdxl']),
        false
      )
    ).toEqual(['model_type:checkpoints', 'sdxl'])
  })

  it('never surfaces namespace residue as a category for uncovered assets in mode', () => {
    expect(
      getAssetCategories(asset(['models', 'model_type:', 'sdxl']), true)
    ).toEqual(['sdxl'])
  })
})

describe('getPrimaryCategoryTag', () => {
  const asset = (tags: string[]): AssetItem => ({
    id: 'a',
    name: 'model.safetensors',
    tags
  })

  it('uses the model_type value a covered asset groups under', () => {
    expect(
      getPrimaryCategoryTag(asset(['models', 'sdxl', 'model_type:vae']), true)
    ).toBe('vae')
  })

  it('keeps the legacy verbatim tag for an uncovered hierarchical asset', () => {
    expect(
      getPrimaryCategoryTag(asset(['models', 'Chatterbox/sub/model']), true)
    ).toBe('Chatterbox/sub/model')
  })

  it('skips namespace residue instead of titling off a raw model_type: tag', () => {
    expect(
      getPrimaryCategoryTag(asset(['models', 'model_type:']), true)
    ).toBeUndefined()
  })

  it('returns the legacy first non-models tag when mode is off', () => {
    expect(
      getPrimaryCategoryTag(asset(['models', 'model_type:vae']), false)
    ).toBe('model_type:vae')
  })
})

describe('getAssetNodeCategoryCandidates', () => {
  const asset = (tags: string[]): AssetItem => ({
    id: 'a',
    name: 'model.safetensors',
    tags
  })

  it('orders the most specific (deepest) tag ahead of a flat model_type value', () => {
    expect(
      getAssetNodeCategoryCandidates(
        asset(['models', 'model_type:LLM', 'LLM/Qwen-VL/Qwen3-0.6B']),
        true
      )
    ).toEqual(['LLM/Qwen-VL/Qwen3-0.6B', 'LLM'])
  })

  it('strips the model_type: prefix when it is the only candidate', () => {
    expect(
      getAssetNodeCategoryCandidates(asset(['models', 'model_type:vae']), true)
    ).toEqual(['vae'])
  })

  it('keeps a model_type value ahead of an equally-deep bare tag', () => {
    expect(
      getAssetNodeCategoryCandidates(
        asset(['models', 'model_type:checkpoints', 'sdxl']),
        true
      )
    ).toEqual(['checkpoints', 'sdxl'])
  })

  it('demotes an unrelated deeper bare tag below the model_type value', () => {
    expect(
      getAssetNodeCategoryCandidates(
        asset(['models', 'model_type:vae', 'foo/bar']),
        true
      )
    ).toEqual(['vae', 'foo/bar'])
  })

  it('keeps unrelated bare tags as trailing fallbacks rather than dropping them', () => {
    expect(
      getAssetNodeCategoryCandidates(
        asset(['models', 'model_type:LLM', 'LLM/Qwen-VL', 'foo/bar/baz']),
        true
      )
    ).toEqual(['LLM/Qwen-VL', 'LLM', 'foo/bar/baz'])
  })

  it('keeps a hierarchical tag intact', () => {
    expect(
      getAssetNodeCategoryCandidates(
        asset(['models', 'chatterbox/chatterbox_vc']),
        true
      )
    ).toEqual(['chatterbox/chatterbox_vc'])
  })

  it('does not repeat a bare tag that duplicates its model_type value', () => {
    expect(
      getAssetNodeCategoryCandidates(
        asset(['models', 'model_type:LLM', 'LLM']),
        true
      )
    ).toEqual(['LLM'])
  })

  it('returns no candidates when only reserved tags are present', () => {
    expect(
      getAssetNodeCategoryCandidates(asset(['models', 'missing']), true)
    ).toEqual([])
  })

  it('uses the first non-reserved tag verbatim when mode is off', () => {
    expect(
      getAssetNodeCategoryCandidates(asset(['models', 'model_type:vae']), false)
    ).toEqual(['model_type:vae'])
    expect(
      getAssetNodeCategoryCandidates(asset(['models', 'checkpoints']), false)
    ).toEqual(['checkpoints'])
  })
})

describe('getAssetTypeBadges', () => {
  const asset = (tags: string[]): AssetItem => ({
    id: 'a',
    name: 'model.safetensors',
    tags
  })

  it('strips the model_type: prefix in model_type mode (no raw leak)', () => {
    expect(
      getAssetTypeBadges(
        asset(['models', 'model_type:checkpoints', 'sdxl']),
        true
      )
    ).toEqual(['checkpoints'])
  })

  it('badges the model_type value even when a bare tag comes first, matching the grouping', () => {
    expect(
      getAssetTypeBadges(asset(['models', 'foo', 'model_type:bar']), true)
    ).toEqual(['bar'])
  })

  it('badges every category a shared multi-type asset groups under', () => {
    expect(
      getAssetTypeBadges(
        asset([
          'models',
          'model_type:checkpoints',
          'model_type:diffusion_models'
        ]),
        true
      )
    ).toEqual(['checkpoints', 'diffusion_models'])
  })

  it('falls back to the bare tag for an uncovered asset in model_type mode', () => {
    expect(getAssetTypeBadges(asset(['models', 'sdxl']), true)).toEqual([
      'sdxl'
    ])
  })

  it('returns no badge rather than a blank one for a malformed empty model_type: tag', () => {
    expect(getAssetTypeBadges(asset(['models', 'model_type:']), true)).toEqual(
      []
    )
  })

  it('leaks the literal model_type: tag when mode is off', () => {
    expect(
      getAssetTypeBadges(asset(['models', 'model_type:checkpoints']), false)
    ).toEqual(['model_type:checkpoints'])
  })

  it('shows the segment after the first slash for a bare hierarchical tag', () => {
    expect(
      getAssetTypeBadges(asset(['models', 'checkpoint/xl']), false)
    ).toEqual(['xl'])
  })

  it('returns no badges when only the models tag is present', () => {
    expect(getAssetTypeBadges(asset(['models']), true)).toEqual([])
  })
})

describe('stripModelTypePrefix', () => {
  it('removes the model_type: prefix when present', () => {
    expect(stripModelTypePrefix('model_type:checkpoints')).toBe('checkpoints')
  })

  it('leaves a tag without the prefix unchanged', () => {
    expect(stripModelTypePrefix('checkpoints')).toBe('checkpoints')
    expect(stripModelTypePrefix('checkpoint/xl')).toBe('checkpoint/xl')
  })
})

describe('reserved tag mirrors', () => {
  const asset = (tags: string[]): AssetItem => ({
    id: 'a',
    name: 'model.safetensors',
    tags
  })

  it("treats assetService's canonical reserved tags as reserved (locals must not drift)", () => {
    expect(getAssetCategories(asset([MODELS_TAG, 'x']), false)).toEqual(['x'])
    expect(
      getAssetNodeCategoryCandidates(
        asset([MODELS_TAG, MISSING_TAG, 'x']),
        true
      )
    ).toEqual(['x'])
    expect(getAssetTypeBadges(asset([MODELS_TAG, 'x']), false)).toEqual(['x'])
    expect(getAssetModelType(asset([MODELS_TAG]))).toBeNull()
  })
})

describe('toModelTypeTag', () => {
  it('prefixes a folder_name with the model_type namespace', () => {
    expect(toModelTypeTag('checkpoints')).toBe('model_type:checkpoints')
    expect(toModelTypeTag('ultralytics_bbox')).toBe(
      'model_type:ultralytics_bbox'
    )
  })
})

describe('getEditableModelType', () => {
  const asset = (tags: string[]): AssetItem => ({
    id: 'a',
    name: 'model.safetensors',
    tags
  })

  it('prefers the model_type value over a distinct bare tag in model_type mode', () => {
    expect(
      getEditableModelType(
        asset(['models', 'checkpoints', 'model_type:loras']),
        true
      )
    ).toBe('loras')
  })

  it('returns the model_type value even when no bare twin is present', () => {
    expect(
      getEditableModelType(asset(['models', 'model_type:loras']), true)
    ).toBe('loras')
  })

  it('ignores an empty model_type value and falls back to the bare tag', () => {
    expect(
      getEditableModelType(
        asset(['models', 'checkpoints', 'model_type:']),
        true
      )
    ).toBe('checkpoints')
  })

  it('resolves the same primary model_type regardless of tag array order', () => {
    const forward = ['models', 'model_type:diffusion_models', 'model_type:unet']
    const reversed = [
      'models',
      'model_type:unet',
      'model_type:diffusion_models'
    ]
    expect(getEditableModelType(asset(forward), true)).toBe('diffusion_models')
    expect(getEditableModelType(asset(reversed), true)).toBe('diffusion_models')
  })

  it('falls back to the bare tag for an uncovered asset in model_type mode', () => {
    expect(getEditableModelType(asset(['models', 'sam2']), true)).toBe('sam2')
  })

  it('uses the legacy first-non-models tag when mode is off', () => {
    expect(
      getEditableModelType(asset(['models', 'checkpoints', 'sdxl']), false)
    ).toBe('checkpoints')
  })

  it('returns null when only the models tag is present', () => {
    expect(getEditableModelType(asset(['models']), true)).toBeNull()
  })
})

describe('buildModelTypeTagUpdate', () => {
  const asset = (tags: string[]): AssetItem => ({
    id: 'a',
    name: 'model.safetensors',
    tags
  })

  it('swaps the bare subtype tag when mode is off', () => {
    expect(
      buildModelTypeTagUpdate(asset(['models', 'checkpoints']), 'loras', false)
    ).toEqual(['models', 'loras'])
  })

  it('preserves user labels and swaps only the subtype tag when mode is off', () => {
    expect(
      buildModelTypeTagUpdate(
        asset(['models', 'checkpoints', 'sdxl']),
        'loras',
        false
      )
    ).toEqual(['models', 'sdxl', 'loras'])
  })

  it('drops the primary model_type form and its stale bare twin for a covered asset', () => {
    expect(
      buildModelTypeTagUpdate(
        asset(['models', 'checkpoints', 'model_type:checkpoints']),
        'loras',
        true
      )
    ).toEqual(['models', 'model_type:loras'])
  })

  it('replaces only the primary membership, preserving sibling model_type memberships', () => {
    expect(
      buildModelTypeTagUpdate(
        asset([
          'models',
          'diffusion_models',
          'model_type:diffusion_models',
          'model_type:unet_gguf'
        ]),
        'loras',
        true
      )
    ).toEqual(['models', 'model_type:unet_gguf', 'model_type:loras'])
  })

  it('replaces the deterministic primary regardless of model_type tag order', () => {
    expect(
      buildModelTypeTagUpdate(
        asset([
          'models',
          'model_type:unet_gguf',
          'model_type:diffusion_models'
        ]),
        'loras',
        true
      )
    ).toEqual(['models', 'model_type:unet_gguf', 'model_type:loras'])
  })

  it('does not duplicate when re-typing to an existing sibling membership', () => {
    expect(
      buildModelTypeTagUpdate(
        asset(['models', 'model_type:diffusion_models', 'model_type:loras']),
        'loras',
        true
      )
    ).toEqual(['models', 'model_type:loras'])
  })

  it('drops the bare current type for an uncovered asset in model_type mode', () => {
    expect(
      buildModelTypeTagUpdate(asset(['models', 'sam2']), 'loras', true)
    ).toEqual(['models', 'model_type:loras'])
  })

  it('keeps user labels but drops the primary bare twin in model_type mode', () => {
    expect(
      buildModelTypeTagUpdate(
        asset(['models', 'checkpoints', 'model_type:checkpoints', 'sdxl']),
        'loras',
        true
      )
    ).toEqual(['models', 'sdxl', 'model_type:loras'])
  })
})

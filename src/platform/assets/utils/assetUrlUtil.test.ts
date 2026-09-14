import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetFileUrl,
  getAssetSubfolder,
  getAssetUrl
} from '@/platform/assets/utils/assetUrlUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'

const mockApiURL = vi.hoisted(() =>
  vi.fn((path: string) => `http://localhost:8188/api${path}`)
)
const mockFlags = vi.hoisted(() => ({ assetsEnabled: false }))

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { apiURL: mockApiURL }
}))

vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({ flags: mockFlags })
}))

function createAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-1',
    name: 'clip.webm',
    tags: ['output'],
    ...overrides
  } as AssetItem
}

describe('getAssetSubfolder', () => {
  it('reads the subfolder from preview_url', () => {
    const asset = createAsset({
      preview_url: '/api/view?filename=clip.webm&type=output&subfolder=vid/2026'
    })

    expect(getAssetSubfolder(asset)).toBe('vid/2026')
  })

  it('falls back to user_metadata when preview_url carries no subfolder', () => {
    const asset = createAsset({
      preview_url: '/api/view?filename=clip.webm&type=output',
      user_metadata: { subfolder: 'vid/2026' }
    })

    expect(getAssetSubfolder(asset)).toBe('vid/2026')
  })

  it('returns an empty string for an asset at the type root', () => {
    expect(getAssetSubfolder(createAsset())).toBe('')
    expect(
      getAssetSubfolder(
        createAsset({ user_metadata: { subfolder: undefined } })
      )
    ).toBe('')
  })
})

describe('getAssetUrl', () => {
  it('includes the subfolder carried by preview_url', () => {
    const asset = createAsset({
      preview_url: '/api/view?filename=clip.webm&type=output&subfolder=vid/2026'
    })

    expect(getAssetUrl(asset)).toContain('subfolder=vid%2F2026')
  })

  it('includes the subfolder taken from the user_metadata fallback', () => {
    const asset = createAsset({
      preview_url: '/api/view?filename=clip.webm&type=output',
      user_metadata: { subfolder: 'vid/2026' }
    })

    expect(getAssetUrl(asset)).toContain('subfolder=vid%2F2026')
  })

  it('omits the subfolder param for an asset at the type root', () => {
    expect(getAssetUrl(createAsset())).not.toContain('subfolder')
  })
})

describe('getAssetFileUrl', () => {
  describe('with the assets API enabled', () => {
    beforeEach(() => {
      mockFlags.assetsEnabled = true
    })

    it('addresses the file by asset id without any path inference', () => {
      const asset = createAsset({
        id: '9a7111df-ccba-4be6-8057-c673755d097c',
        name: 'ComfyUI_00110.glb',
        display_name: '3d/ComfyUI_00110.glb'
      })

      expect(getAssetFileUrl(asset)).toBe(
        'http://localhost:8188/api/assets/9a7111df-ccba-4be6-8057-c673755d097c/content'
      )
    })

    it('uses the own asset id kept by a card grouped per job', () => {
      const asset = createAsset({
        id: 'job-1',
        name: 'ComfyUI_00110.glb',
        user_metadata: {
          jobId: 'job-1',
          subfolder: '',
          assetId: 'asset-model-later',
          outputCount: 2,
          allOutputs: [
            { assetId: 'asset-model-earlier', filename: 'ComfyUI_00110.glb' },
            { assetId: 'asset-model-later', filename: 'ComfyUI_00110.glb' }
          ] as AugmentedResultItem[]
        }
      })

      expect(getAssetFileUrl(asset)).toBe(
        'http://localhost:8188/api/assets/asset-model-later/content'
      )
    })

    it('does not use a preview url that points at a thumbnail', () => {
      const asset = createAsset({
        id: 'asset-model',
        name: 'mesh.glb',
        preview_id: 'asset-thumb',
        preview_url: '/api/view?type=output&filename=thumb.png'
      })

      expect(getAssetFileUrl(asset)).toBe(
        'http://localhost:8188/api/assets/asset-model/content'
      )
    })
  })

  describe('with history-backed assets', () => {
    beforeEach(() => {
      mockFlags.assetsEnabled = false
    })

    it('uses preview_url, which already points at the file', () => {
      const asset = createAsset({
        preview_url: '/api/view?filename=clip.webm&type=output&subfolder=vid'
      })

      expect(getAssetFileUrl(asset)).toBe(
        '/api/view?filename=clip.webm&type=output&subfolder=vid'
      )
    })

    it('builds a /view url from the metadata subfolder when preview_url is absent', () => {
      const asset = createAsset({
        name: 'mesh.glb',
        user_metadata: { subfolder: '3d' }
      })

      const { searchParams } = new URL(getAssetFileUrl(asset))
      expect(searchParams.get('filename')).toBe('mesh.glb')
      expect(searchParams.get('type')).toBe('output')
      expect(searchParams.get('subfolder')).toBe('3d')
    })
  })
})

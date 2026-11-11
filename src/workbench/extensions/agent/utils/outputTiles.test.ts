import { describe, expect, it, vi } from 'vitest'

import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import {
  asFileSelection,
  outputAttachment,
  outputGalleryItem,
  outputTileKey,
  outputTileKind
} from './outputTiles'

vi.mock(import('@/scripts/api'))

const HASH = `blake3:${'a'.repeat(64)}`

function createOutputAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-1',
    name: 'ComfyUI_00001_.png',
    hash: HASH,
    tags: ['output'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  }
}

function createJobAsset(): AssetItem {
  const metadata: OutputAssetMetadata = {
    jobId: 'job-1',
    nodeId: '9',
    subfolder: '',
    assetId: 'asset-3',
    outputCount: 3,
    allOutputs: [
      {
        assetId: 'asset-1',
        filename: 'ComfyUI_00001_.png',
        display_name: 'first.png',
        mediaType: 'image',
        nodeId: '9',
        subfolder: '',
        type: 'output'
      }
    ]
  }
  return createOutputAsset({
    id: 'job-1',
    name: 'ComfyUI_00003_.png',
    display_name: 'third.png',
    user_metadata: metadata
  })
}

describe('outputTileKey', () => {
  it('keys a tile by its asset id', () => {
    expect(outputTileKey(createOutputAsset({ id: 'asset-7' }))).toBe('asset-7')
  })
})

describe('outputTileKind', () => {
  it.for([
    { name: 'ComfyUI_00001_.png', kind: 'image' },
    { name: 'clip.mp4', kind: 'video' },
    { name: 'voice.flac', kind: 'audio' },
    { name: 'mesh.glb', kind: '3D' },
    { name: 'latent.safetensors', kind: 'other' }
  ])('reads $name as $kind', ({ name, kind }) => {
    expect(outputTileKind(createOutputAsset({ name }))).toBe(kind)
  })

  it('reads the kind from the file name, not the display name', () => {
    const asset = createOutputAsset({
      name: 'clip.mp4',
      display_name: 'poster.png'
    })

    expect(outputTileKind(asset)).toBe('video')
  })
})

describe('outputAttachment', () => {
  it('attaches an image with its preview', () => {
    expect(outputAttachment(createOutputAsset())).toEqual({
      id: `asset:${HASH}`,
      name: 'ComfyUI_00001_.png',
      ref: HASH,
      previewUrl: 'http://localhost:3000/api/assets/asset-1/content'
    })
  })

  it.for(['clip.mp4', 'voice.flac', 'mesh.glb'])(
    'attaches %s without a preview',
    (name) => {
      expect(outputAttachment(createOutputAsset({ name }))).toEqual({
        id: `asset:${HASH}`,
        name,
        ref: HASH,
        previewUrl: undefined
      })
    }
  )

  it('does not attach a file of a kind the agent cannot take', () => {
    const asset = createOutputAsset({ name: 'latent.safetensors' })

    expect(outputAttachment(asset)).toBeUndefined()
  })

  it('names the file by its display name when it has one', () => {
    const asset = createOutputAsset({ display_name: 'Sunset over the bay.png' })

    expect(outputAttachment(asset)?.name).toBe('Sunset over the bay.png')
  })

  it('refers to a file with no hash by its name', () => {
    const asset = createOutputAsset({ hash: undefined })

    expect(outputAttachment(asset)).toMatchObject({
      id: 'asset:ComfyUI_00001_.png',
      ref: 'ComfyUI_00001_.png'
    })
  })

  it('does not attach a file with neither a hash nor a name', () => {
    const asset = createOutputAsset({ hash: undefined, name: '' })

    expect(outputAttachment(asset)).toBeUndefined()
  })

  it('names and refers to the file a job tile shows, not the first output of its job', () => {
    expect(outputAttachment(createJobAsset())).toEqual({
      id: `asset:${HASH}`,
      name: 'third.png',
      ref: HASH,
      previewUrl: 'http://localhost:3000/api/assets/asset-3/content'
    })
  })
})

describe('asFileSelection', () => {
  it('drops the fields that mark a tile as a multi-output job', () => {
    expect(asFileSelection(createJobAsset())).toEqual({
      ...createOutputAsset({
        id: 'job-1',
        name: 'ComfyUI_00003_.png',
        display_name: 'third.png'
      }),
      user_metadata: {
        jobId: 'job-1',
        nodeId: '9',
        subfolder: '',
        assetId: 'asset-3'
      }
    })
  })

  it('leaves the asset it was given unchanged', () => {
    const asset = createJobAsset()

    asFileSelection(asset)

    expect(asset).toEqual(createJobAsset())
  })

  it('copies an asset that has no user metadata', () => {
    const asset = createOutputAsset()

    const selection = asFileSelection(asset)

    expect(selection).toEqual(asset)
    expect(selection).not.toBe(asset)
  })
})

describe('outputGalleryItem', () => {
  it.for([
    { name: 'ComfyUI_00001_.png', mediaType: 'images' },
    { name: 'clip.mp4', mediaType: 'video' },
    { name: 'voice.flac', mediaType: 'audio' }
  ])('shows $name in the gallery as $mediaType', ({ name, mediaType }) => {
    const asset = createOutputAsset({
      name,
      preview_url: `/api/view?filename=${name}&type=output`
    })

    expect(outputGalleryItem(asset)).toEqual({
      filename: name,
      subfolder: '',
      type: 'output',
      nodeId: '',
      mediaType,
      mediaTypeIsResolved: true,
      url: `/api/view?filename=${name}&type=output`
    })
  })

  it('opens the file itself, not its thumbnail', () => {
    const asset = createOutputAsset({
      thumbnail_url: '/api/view?filename=ComfyUI_00001_.png&res=512',
      preview_url: '/api/view?filename=ComfyUI_00001_.png&type=output'
    })

    expect(outputGalleryItem(asset).url).toBe(
      '/api/view?filename=ComfyUI_00001_.png&type=output'
    )
  })

  it('keeps the subfolder the file lives in', () => {
    const asset = createOutputAsset({
      preview_url:
        '/api/view?filename=ComfyUI_00001_.png&type=output&subfolder=portraits'
    })

    expect(outputGalleryItem(asset).subfolder).toBe('portraits')
  })

  it('builds the file address for an asset that has no preview', () => {
    expect(outputGalleryItem(createOutputAsset()).url).toBe(
      '/api/view?filename=ComfyUI_00001_.png&type=output'
    )
  })
})

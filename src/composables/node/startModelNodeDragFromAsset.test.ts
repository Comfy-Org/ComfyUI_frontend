import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { startModelNodeDragFromAsset } from '@/composables/node/startModelNodeDragFromAsset'

const { mockStartDrag, mockGetNodeProvider } = vi.hoisted(() => ({
  mockStartDrag: vi.fn(),
  mockGetNodeProvider: vi.fn()
}))

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({ startDrag: mockStartDrag })
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({ getNodeProvider: mockGetNodeProvider })
}))

function createAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-123',
    name: 'sd_xl_base_1.0.safetensors',
    size: 1024,
    created_at: '2025-10-01T00:00:00Z',
    tags: ['models', 'checkpoints'],
    user_metadata: { filename: 'sd_xl_base_1.0.safetensors' },
    ...overrides
  }
}

describe('startModelNodeDragFromAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('starts a ghost drag for the resolved node carrying the widget value', () => {
    const nodeDef = { name: 'CheckpointLoaderSimple' }
    mockGetNodeProvider.mockReturnValue({ nodeDef, key: 'ckpt_name' })

    const error = startModelNodeDragFromAsset(createAsset())

    expect(error).toBeUndefined()
    expect(mockStartDrag).toHaveBeenCalledWith(nodeDef, {
      widgetValues: { ckpt_name: 'sd_xl_base_1.0.safetensors' },
      source: 'sidebar_drag'
    })
  })

  it('threads the node-add source through to the drag', () => {
    const nodeDef = { name: 'CheckpointLoaderSimple' }
    mockGetNodeProvider.mockReturnValue({ nodeDef, key: 'ckpt_name' })

    startModelNodeDragFromAsset(createAsset(), 'asset_browser')

    expect(mockStartDrag).toHaveBeenCalledWith(nodeDef, {
      widgetValues: { ckpt_name: 'sd_xl_base_1.0.safetensors' },
      source: 'asset_browser'
    })
  })

  it('carries no widget value when the provider has no key', () => {
    const nodeDef = { name: 'FL_ChatterboxVC' }
    mockGetNodeProvider.mockReturnValue({ nodeDef, key: '' })

    startModelNodeDragFromAsset(
      createAsset({
        tags: ['models', 'chatterbox/chatterbox_vc'],
        user_metadata: { filename: 'chatterbox_vc_model.pt' }
      })
    )

    expect(mockStartDrag).toHaveBeenCalledWith(nodeDef, {
      widgetValues: undefined,
      source: 'sidebar_drag'
    })
  })

  it('returns the resolution error and does not start a drag for an invalid asset', () => {
    mockGetNodeProvider.mockReturnValue(null)

    const error = startModelNodeDragFromAsset(createAsset())

    expect(error?.code).toBe('NO_PROVIDER')
    expect(mockStartDrag).not.toHaveBeenCalled()
  })
})

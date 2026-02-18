import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { useMediaAssetActions } from './useMediaAssetActions'

// Use vi.hoisted to create a mutable reference for isCloud
const mockIsCloud = vi.hoisted(() => ({ value: false }))

// Track the filename passed to createAnnotatedPath
const capturedFilenames = vi.hoisted(() => ({ values: [] as string[] }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn()
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  }),
  createI18n: () => ({
    global: {
      t: (key: string) => key
    }
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    showDialog: vi.fn()
  })
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: vi.fn()
  })
}))

vi.mock('@/platform/workflow/core/services/workflowActionsService', () => ({
  useWorkflowActionsService: () => ({
    openWorkflowAction: vi.fn(),
    exportWorkflowAction: vi.fn()
  })
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({
    addNodeOnGraph: vi.fn().mockReturnValue({
      widgets: [{ name: 'image', value: '', callback: vi.fn() }],
      graph: { setDirtyCanvas: vi.fn() }
    } as unknown as LGraphNode),
    getCanvasCenter: vi.fn().mockReturnValue([100, 100])
  })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    nodeDefsByName: {
      LoadImage: {
        name: 'LoadImage',
        display_name: 'Load Image'
      }
    }
  })
}))

vi.mock('@/utils/createAnnotatedPath', () => ({
  createAnnotatedPath: vi.fn((item: { filename: string }) => {
    capturedFilenames.values.push(item.filename)
    return item.filename
  })
}))

vi.mock('@/utils/loaderNodeUtil', () => ({
  detectNodeTypeFromFilename: vi.fn().mockReturnValue({
    nodeType: 'LoadImage',
    widgetName: 'image'
  })
}))

vi.mock('@/utils/typeGuardUtil', () => ({
  isResultItemType: vi.fn().mockReturnValue(true)
}))

vi.mock('@/platform/assets/utils/assetTypeUtil', () => ({
  getAssetType: vi.fn().mockReturnValue('input')
}))

vi.mock('../schemas/assetMetadataSchema', () => ({
  getOutputAssetMetadata: vi.fn().mockReturnValue(null)
}))

function createMockAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'test-asset-id',
    name: 'original-name.jpeg',
    size: 1024,
    created_at: '2025-01-01T00:00:00Z',
    tags: ['input'],
    ...overrides
  }
}

describe('useMediaAssetActions', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    capturedFilenames.values = []
    mockIsCloud.value = false
  })

  describe('addWorkflow', () => {
    describe('OSS mode (isCloud = false)', () => {
      beforeEach(() => {
        mockIsCloud.value = false
      })

      it('should use asset.name as filename', async () => {
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'my-image.jpeg',
          asset_hash: 'hash123.jpeg'
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('my-image.jpeg')
      })
    })

    describe('Cloud mode (isCloud = true)', () => {
      beforeEach(() => {
        mockIsCloud.value = true
      })

      it('should use asset_hash as filename when available', async () => {
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'original.jpeg',
          asset_hash: 'abc123hash.jpeg'
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('abc123hash.jpeg')
      })

      it('should fall back to asset.name when asset_hash is not available', async () => {
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'fallback-name.jpeg',
          asset_hash: undefined
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('fallback-name.jpeg')
      })

      it('should fall back to asset.name when asset_hash is null', async () => {
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'fallback-null.jpeg',
          asset_hash: null
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('fallback-null.jpeg')
      })
    })
  })

  describe('addMultipleToWorkflow', () => {
    describe('Cloud mode (isCloud = true)', () => {
      beforeEach(() => {
        mockIsCloud.value = true
      })

      it('should use asset_hash for each asset', async () => {
        const actions = useMediaAssetActions()

        const assets = [
          createMockAsset({
            id: '1',
            name: 'file1.jpeg',
            asset_hash: 'hash1.jpeg'
          }),
          createMockAsset({
            id: '2',
            name: 'file2.jpeg',
            asset_hash: 'hash2.jpeg'
          })
        ]

        await actions.addMultipleToWorkflow(assets)

        expect(capturedFilenames.values).toContain('hash1.jpeg')
        expect(capturedFilenames.values).toContain('hash2.jpeg')
        expect(capturedFilenames.values).not.toContain('file1.jpeg')
        expect(capturedFilenames.values).not.toContain('file2.jpeg')
      })
    })
  })
})

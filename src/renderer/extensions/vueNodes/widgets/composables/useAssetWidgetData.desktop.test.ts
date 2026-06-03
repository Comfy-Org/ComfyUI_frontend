import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'

vi.mock('@/platform/distribution/types', () => ({ isCloud: false }))

const mockLocalAssets = ref<AssetItem[]>([])
const mockGetCategoryForNodeType = vi.fn()

vi.mock('@/composables/sidebarTabs/useLocalModelLibrarySource', () => ({
  useLocalModelLibrarySource: () => ({
    assets: computed(() => mockLocalAssets.value),
    isLoading: ref(false),
    refresh: vi.fn()
  })
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({
    getCategoryForNodeType: mockGetCategoryForNodeType
  })
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({})
}))

function asset(id: string, directory: string): AssetItem {
  return {
    id,
    name: id,
    size: 1024,
    tags: ['models', directory],
    created_at: '2025-01-01T00:00:00Z',
    metadata: { directory }
  }
}

describe('useAssetWidgetData (desktop/localhost, isCloud=false)', () => {
  beforeEach(() => {
    mockLocalAssets.value = []
    mockGetCategoryForNodeType.mockReset()
  })

  it('returns local-source assets scoped to the node category directory', () => {
    mockLocalAssets.value = [
      asset('a', 'checkpoints'),
      asset('b', 'loras'),
      asset('c', 'checkpoints')
    ]
    mockGetCategoryForNodeType.mockReturnValue('checkpoints')

    const { category, assets } = useAssetWidgetData('CheckpointLoaderSimple')

    expect(category.value).toBe('checkpoints')
    expect(assets.value.map((a) => a.id)).toEqual(['a', 'c'])
  })

  it('returns empty when the node type has no category', () => {
    mockLocalAssets.value = [asset('a', 'checkpoints')]
    mockGetCategoryForNodeType.mockReturnValue(undefined)

    const { assets } = useAssetWidgetData('UnknownNodeType')

    expect(assets.value).toEqual([])
  })
})

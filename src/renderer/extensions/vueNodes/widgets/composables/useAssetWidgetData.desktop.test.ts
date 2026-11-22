import { useAssetsStore } from '@/stores/assetsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false
}))

describe('useAssetWidgetData (desktop/isCloud=false)', () => {
  it('returns empty/default values without calling stores', () => {
    const nodeType = ref('CheckpointLoaderSimple')
    const { category, assets, isLoading, error } = useAssetWidgetData(nodeType)

    expect(category.value).toBeUndefined()
    expect(assets.value).toEqual([])
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(useAssetsStore().updateModelsForNodeType).not.toHaveBeenCalled()
    expect(useModelToNodeStore().getCategoryForNodeType).not.toHaveBeenCalled()
  })
})

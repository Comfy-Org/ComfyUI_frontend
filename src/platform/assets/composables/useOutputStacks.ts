import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'

export type OutputStackListItem = {
  key: string
  asset: AssetItem
  isChild?: boolean
}

type UseOutputStacksOptions = {
  assets: Ref<AssetItem[]>
}

export function useOutputStacks({ assets }: UseOutputStacksOptions) {
  const expandedStackPromptIds = ref<Set<string>>(new Set())
  const stackChildrenByPromptId = ref<Record<string, AssetItem[]>>({})
  const loadingStackPromptIds = ref<Set<string>>(new Set())

  const assetItems = computed<OutputStackListItem[]>(() => {
    const items: OutputStackListItem[] = []

    for (const asset of assets.value) {
      const promptId = getStackPromptId(asset)
      items.push({
        key: `asset-${asset.id}`,
        asset
      })

      if (!promptId || !expandedStackPromptIds.value.has(promptId)) {
        continue
      }

      const children = stackChildrenByPromptId.value[promptId] ?? []
      for (const child of children) {
        items.push({
          key: `asset-${child.id}`,
          asset: child,
          isChild: true
        })
      }
    }

    return items
  })

  const selectableAssets = computed(() =>
    assetItems.value.map((item) => item.asset)
  )

  function getStackPromptId(asset: AssetItem): string | null {
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    return metadata?.promptId ?? null
  }

  function isStackExpanded(asset: AssetItem): boolean {
    const promptId = getStackPromptId(asset)
    if (!promptId) return false
    return expandedStackPromptIds.value.has(promptId)
  }

  async function toggleStack(asset: AssetItem) {
    const promptId = getStackPromptId(asset)
    if (!promptId) return

    if (expandedStackPromptIds.value.has(promptId)) {
      const next = new Set(expandedStackPromptIds.value)
      next.delete(promptId)
      expandedStackPromptIds.value = next
      return
    }

    if (!stackChildrenByPromptId.value[promptId]?.length) {
      if (loadingStackPromptIds.value.has(promptId)) {
        return
      }
      const nextLoading = new Set(loadingStackPromptIds.value)
      nextLoading.add(promptId)
      loadingStackPromptIds.value = nextLoading

      const children = await resolveStackChildren(asset)

      const afterLoading = new Set(loadingStackPromptIds.value)
      afterLoading.delete(promptId)
      loadingStackPromptIds.value = afterLoading

      if (!children.length) {
        return
      }

      stackChildrenByPromptId.value = {
        ...stackChildrenByPromptId.value,
        [promptId]: children
      }
    }

    const nextExpanded = new Set(expandedStackPromptIds.value)
    nextExpanded.add(promptId)
    expandedStackPromptIds.value = nextExpanded
  }

  async function resolveStackChildren(asset: AssetItem): Promise<AssetItem[]> {
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    if (!metadata) {
      return []
    }
    try {
      return await resolveOutputAssetItems(metadata, {
        createdAt: asset.created_at,
        excludeOutputKey: asset.name
      })
    } catch (error) {
      console.error('Failed to resolve stack children:', error)
      return []
    }
  }

  return {
    assetItems,
    selectableAssets,
    isStackExpanded,
    toggleStack
  }
}

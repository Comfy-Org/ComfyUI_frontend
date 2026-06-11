import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getOutputKey,
  resolveOutputAssetItems
} from '@/platform/assets/utils/outputAssetUtil'

export type OutputStackListItem = {
  key: string
  asset: AssetItem
  isChild?: boolean
}

type UseOutputStacksOptions = {
  assets: Ref<AssetItem[]>
  /**
   * Override the job id used for stack identity. Return `undefined` to fall
   * back to the default (history-shaped user_metadata), `null` for no stack.
   */
  getJobId?: (asset: AssetItem) => string | null | undefined
  /**
   * Provide stack children synchronously from memory (e.g. job grouping on
   * the assets-API path). Return `undefined` to fall back to the default
   * async resolution from job history.
   */
  liveChildren?: (asset: AssetItem) => AssetItem[] | undefined
}

export function useOutputStacks({
  assets,
  getJobId,
  liveChildren
}: UseOutputStacksOptions) {
  const expandedStackJobIds = ref<Set<string>>(new Set())
  const stackChildrenByJobId = ref<Record<string, AssetItem[]>>({})
  const loadingStackJobIds = ref<Set<string>>(new Set())

  const assetItems = computed<OutputStackListItem[]>(() => {
    const items: OutputStackListItem[] = []

    for (const asset of assets.value) {
      const jobId = getStackJobId(asset)
      items.push({
        key: `asset-${asset.id}`,
        asset
      })

      if (!jobId || !expandedStackJobIds.value.has(jobId)) {
        continue
      }

      const children =
        liveChildren?.(asset) ?? stackChildrenByJobId.value[jobId] ?? []
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

  function getStackJobId(asset: AssetItem): string | null {
    const override = getJobId?.(asset)
    if (override !== undefined) return override
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    return metadata?.jobId ?? null
  }

  function isStackExpanded(asset: AssetItem): boolean {
    const jobId = getStackJobId(asset)
    if (!jobId) return false
    return expandedStackJobIds.value.has(jobId)
  }

  async function toggleStack(asset: AssetItem) {
    const jobId = getStackJobId(asset)
    if (!jobId) return

    if (expandedStackJobIds.value.has(jobId)) {
      const next = new Set(expandedStackJobIds.value)
      next.delete(jobId)
      expandedStackJobIds.value = next
      return
    }

    if (liveChildren?.(asset) !== undefined) {
      const nextExpanded = new Set(expandedStackJobIds.value)
      nextExpanded.add(jobId)
      expandedStackJobIds.value = nextExpanded
      return
    }

    if (!stackChildrenByJobId.value[jobId]?.length) {
      if (loadingStackJobIds.value.has(jobId)) {
        return
      }
      const nextLoading = new Set(loadingStackJobIds.value)
      nextLoading.add(jobId)
      loadingStackJobIds.value = nextLoading

      const children = await resolveStackChildren(asset)

      const afterLoading = new Set(loadingStackJobIds.value)
      afterLoading.delete(jobId)
      loadingStackJobIds.value = afterLoading

      if (!children.length) {
        return
      }

      stackChildrenByJobId.value = {
        ...stackChildrenByJobId.value,
        [jobId]: children
      }
    }

    const nextExpanded = new Set(expandedStackJobIds.value)
    nextExpanded.add(jobId)
    expandedStackJobIds.value = nextExpanded
  }

  async function resolveStackChildren(asset: AssetItem): Promise<AssetItem[]> {
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    if (!metadata) {
      return []
    }

    const excludeOutputKey =
      getOutputKey({
        nodeId: metadata.nodeId,
        subfolder: metadata.subfolder,
        filename: asset.name
      }) ?? undefined

    try {
      return await resolveOutputAssetItems(metadata, {
        createdAt: asset.created_at,
        excludeOutputKey
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

import { whenever } from '@vueuse/core'
import { orderBy } from 'es-toolkit/compat'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import { useInstalledPacks } from '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks'
import { useWorkflowPacks } from '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/workbench/extensions/manager/stores/conflictDetectionStore'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import {
  PACK_SORTABLE_FIELDS,
  getPackSortValue
} from '@/workbench/extensions/manager/utils/nodePackSort'
import { getPackUpdateStatus } from '@/workbench/extensions/manager/utils/packUpdateStatus'

type NodePack = components['schemas']['Node']

export function useManagerDisplayPacks(
  selectedTabId: MaybeRefOrGetter<string | null>,
  searchResults: MaybeRefOrGetter<NodePack[]>,
  searchQuery: MaybeRefOrGetter<string>,
  sortField: MaybeRefOrGetter<string>
) {
  const comfyManagerStore = useComfyManagerStore()
  const conflictDetectionStore = useConflictDetectionStore()

  const {
    startFetchInstalled,
    filterInstalledPack,
    installedPacks,
    isLoading: isLoadingInstalled,
    isReady: installedPacksReady
  } = useInstalledPacks()

  const {
    startFetchWorkflowPacks,
    filterWorkflowPack,
    workflowPacks,
    isLoading: isLoadingWorkflow,
    isReady: workflowPacksReady
  } = useWorkflowPacks()

  const tabType = computed(() => toValue(selectedTabId) as ManagerTab | null)
  const isEmptySearch = computed(() => toValue(searchQuery) === '')

  const sortPacks = (packs: NodePack[]) => {
    const field = toValue(sortField)
    if (!field || packs.length === 0) return packs

    const fieldConfig = PACK_SORTABLE_FIELDS.find((f) => f.id === field)
    const direction = fieldConfig?.direction || 'desc'

    return orderBy(
      packs,
      [(pack) => getPackSortValue(pack, field)],
      [direction]
    )
  }

  // Filter functions
  const filterNotInstalled = (packs: NodePack[]) =>
    packs.filter((p) => !comfyManagerStore.isPackInstalled(p.id))

  const filterConflicting = (packs: NodePack[]) =>
    packs.filter(
      (p) =>
        !!p.id &&
        conflictDetectionStore.conflictedPackages.some(
          (c) => c.package_id === p.id
        )
    )

  const filterOutdated = (packs: NodePack[]) =>
    packs.filter(
      (p) => getPackUpdateStatus(p, comfyManagerStore).isUpdateAvailable
    )

  // Data fetching triggers using whenever
  const needsInstalledPacks = computed(() =>
    [
      ManagerTab.AllInstalled,
      ManagerTab.UpdateAvailable,
      ManagerTab.Conflicting
    ].includes(tabType.value as ManagerTab)
  )

  const needsWorkflowPacks = computed(() =>
    [ManagerTab.Workflow, ManagerTab.Missing].includes(
      tabType.value as ManagerTab
    )
  )

  // Sorting only applies to fully-fetched tabs with no active search; paged
  // search/listing results (All, NotInstalled) are shown in the API's order.
  const isSortable = computed(
    () =>
      isEmptySearch.value &&
      (needsInstalledPacks.value || needsWorkflowPacks.value)
  )

  whenever(
    () =>
      needsInstalledPacks.value &&
      !installedPacksReady.value &&
      !isLoadingInstalled.value,
    () => startFetchInstalled()
  )

  whenever(
    () =>
      needsWorkflowPacks.value &&
      !workflowPacksReady.value &&
      !isLoadingWorkflow.value,
    () => startFetchWorkflowPacks()
  )

  // For Missing tab, also need installed packs to determine what's missing
  whenever(
    () =>
      tabType.value === ManagerTab.Missing &&
      !installedPacksReady.value &&
      !isLoadingInstalled.value,
    () => startFetchInstalled()
  )

  // Single computed for display packs - replaces 7 watches
  const displayPacks = computed(() => {
    const tab = tabType.value
    const hasSearch = !isEmptySearch.value
    const results = toValue(searchResults)

    switch (tab) {
      case ManagerTab.All:
        return results

      case ManagerTab.NotInstalled:
        return filterNotInstalled(results)

      case ManagerTab.AllInstalled:
        return hasSearch
          ? filterInstalledPack(results)
          : sortPacks(installedPacks.value)

      case ManagerTab.UpdateAvailable:
        return hasSearch
          ? filterOutdated(filterInstalledPack(results))
          : sortPacks(filterOutdated(installedPacks.value))

      case ManagerTab.Conflicting:
        return hasSearch
          ? filterConflicting(filterInstalledPack(results))
          : sortPacks(filterConflicting(installedPacks.value))

      case ManagerTab.Workflow:
        return hasSearch
          ? filterWorkflowPack(results)
          : sortPacks(workflowPacks.value)

      case ManagerTab.Missing:
        return hasSearch
          ? filterNotInstalled(filterWorkflowPack(results))
          : sortPacks(filterNotInstalled(workflowPacks.value))

      case ManagerTab.Unresolved:
        return []

      default:
        return results
    }
  })

  // Loading state - single computed
  const isLoading = computed(() => {
    const tab = tabType.value
    if (
      [
        ManagerTab.AllInstalled,
        ManagerTab.UpdateAvailable,
        ManagerTab.Conflicting
      ].includes(tab as ManagerTab)
    ) {
      return isLoadingInstalled.value
    }
    if ([ManagerTab.Workflow, ManagerTab.Missing].includes(tab as ManagerTab)) {
      return isLoadingWorkflow.value
    }
    return false
  })

  const missingNodePacks = computed(() =>
    filterNotInstalled(workflowPacks.value)
  )

  return {
    displayPacks,
    isSortable,
    isLoading,
    isLoadingInstalled,
    isLoadingWorkflow,
    installedPacks,
    workflowPacks,
    filterInstalledPack,
    filterWorkflowPack,
    missingNodePacks
  }
}

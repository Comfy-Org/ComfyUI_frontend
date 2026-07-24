import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useErrorGroups } from '@/components/rightSidePanel/errors/useErrorGroups'
import type {
  MissingPackGroup,
  SwapNodeGroup
} from '@/components/rightSidePanel/errors/useErrorGroups'
import type { ErrorGroup } from '@/components/rightSidePanel/errors/types'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import type { MissingModelGroup } from '@/platform/missingModel/types'

type OverlayCopy = { title?: string; message: string }

function resolveSingleOverlayCopy(group: ErrorGroup): OverlayCopy | undefined {
  if (group.type === 'execution') {
    const [card] = group.cards
    const [error] = card?.errors ?? []
    const message =
      error?.toastMessage ??
      error?.displayMessage ??
      error?.message ??
      group.displayMessage ??
      group.displayTitle

    if (!message) return undefined

    return {
      title: error?.toastTitle ?? error?.displayTitle ?? group.displayTitle,
      message
    }
  }

  const message =
    group.toastMessage ?? group.displayMessage ?? group.displayTitle
  if (!message) return undefined

  return {
    title: group.toastTitle ?? group.displayTitle,
    message
  }
}

function resolveGroupOverlayCopy(group: ErrorGroup): OverlayCopy | undefined {
  const message =
    group.displayMessage ?? group.toastMessage ?? group.displayTitle
  if (!message) return undefined

  return {
    title: group.displayTitle,
    message
  }
}

function countMissingNodeReferences(groups: MissingPackGroup[]): number {
  return groups.reduce((count, group) => count + group.nodeTypes.length, 0)
}

function countSwapNodeReferences(groups: SwapNodeGroup[]): number {
  return groups.reduce((count, group) => count + group.nodeTypes.length, 0)
}

function getMissingModelRows(groups: MissingModelGroup[]) {
  return groups.flatMap((group) => group.models)
}

function getMissingMediaRows(groups: MissingMediaGroup[]) {
  return groups.flatMap((group) => group.items)
}

function hasSingleRowWithAtMostOneReference(
  rows: Array<{ referencingNodes: readonly unknown[] }>
): boolean {
  const row = rows[0]
  return (
    rows.length === 1 && row !== undefined && row.referencingNodes.length <= 1
  )
}

interface OverlayGroupContext {
  missingPackGroups: MissingPackGroup[]
  missingModelGroups: MissingModelGroup[]
  missingMediaGroups: MissingMediaGroup[]
  swapNodeGroups: SwapNodeGroup[]
}

function isSingleLeafGroup(
  group: ErrorGroup,
  context: OverlayGroupContext
): boolean {
  if (group.type === 'execution') {
    return group.cards.length === 1 && group.cards[0]?.errors.length === 1
  }

  if (group.type === 'missing_node') {
    return (
      context.missingPackGroups.length === 1 &&
      countMissingNodeReferences(context.missingPackGroups) === 1
    )
  }

  if (group.type === 'swap_nodes') {
    return (
      context.swapNodeGroups.length === 1 &&
      countSwapNodeReferences(context.swapNodeGroups) === 1
    )
  }

  if (group.type === 'missing_model') {
    return hasSingleRowWithAtMostOneReference(
      getMissingModelRows(context.missingModelGroups)
    )
  }

  return hasSingleRowWithAtMostOneReference(
    getMissingMediaRows(context.missingMediaGroups)
  )
}

function shouldUseAggregateCopyForSingleGroup(
  group: ErrorGroup,
  context: OverlayGroupContext
): boolean {
  if (group.type === 'missing_node') {
    return context.missingPackGroups.length > 1
  }

  if (group.type === 'swap_nodes') {
    return context.swapNodeGroups.length > 1
  }

  if (group.type === 'missing_model') {
    return getMissingModelRows(context.missingModelGroups).length > 1
  }

  if (group.type === 'missing_media') {
    return getMissingMediaRows(context.missingMediaGroups).length > 1
  }

  return false
}

export function useErrorOverlayState() {
  const { t } = useI18n()
  const executionErrorStore = useExecutionErrorStore()
  const { isErrorOverlayOpen } = storeToRefs(executionErrorStore)
  const {
    allErrorGroups,
    missingPackGroups,
    missingModelGroups,
    missingMediaGroups,
    swapNodeGroups
  } = useErrorGroups('')

  const totalErrorCount = computed(() =>
    allErrorGroups.value.reduce((sum, group) => sum + group.count, 0)
  )

  const multipleErrorCountLabel = computed(() =>
    t(
      'errorOverlay.multipleErrorCount',
      { count: totalErrorCount.value },
      totalErrorCount.value
    )
  )

  const aggregateOverlayCopy = computed<OverlayCopy>(() => ({
    title: multipleErrorCountLabel.value,
    message: t('errorOverlay.multipleErrorsMessage')
  }))

  const overlayCopy = computed<OverlayCopy | undefined>(() => {
    const groups = allErrorGroups.value
    if (groups.length === 0) return undefined
    if (groups.length > 1) return aggregateOverlayCopy.value

    const [group] = groups
    const context = {
      missingPackGroups: missingPackGroups.value,
      missingModelGroups: missingModelGroups.value,
      missingMediaGroups: missingMediaGroups.value,
      swapNodeGroups: swapNodeGroups.value
    }

    if (shouldUseAggregateCopyForSingleGroup(group, context)) {
      return aggregateOverlayCopy.value
    }

    if (isSingleLeafGroup(group, context)) {
      return resolveSingleOverlayCopy(group) ?? resolveGroupOverlayCopy(group)
    }

    return resolveGroupOverlayCopy(group)
  })

  const overlayMessage = computed(() => overlayCopy.value?.message ?? '')

  const overlayTitle = computed(() => overlayCopy.value?.title ?? '')

  const isVisible = computed(
    () =>
      isErrorOverlayOpen.value &&
      totalErrorCount.value > 0 &&
      overlayMessage.value.trim().length > 0
  )

  return {
    isVisible,
    overlayMessage,
    overlayTitle
  }
}

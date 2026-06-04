import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useErrorGroups } from '@/components/rightSidePanel/errors/useErrorGroups'
import type { ErrorGroup } from '@/components/rightSidePanel/errors/types'

function resolveSingleOverlayCopy(
  group: ErrorGroup
): { title?: string; message: string } | undefined {
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

export function useErrorOverlayState() {
  const { t } = useI18n()
  const executionErrorStore = useExecutionErrorStore()
  const { totalErrorCount, isErrorOverlayOpen } =
    storeToRefs(executionErrorStore)
  const { allErrorGroups } = useErrorGroups('')

  const hasExactlyOneError = computed(() => totalErrorCount.value === 1)
  const hasMultipleErrors = computed(() => totalErrorCount.value > 1)
  const singleErrorGroup = computed(() =>
    hasExactlyOneError.value && allErrorGroups.value.length === 1
      ? allErrorGroups.value[0]
      : undefined
  )

  const errorCountLabel = computed(() =>
    t(
      'errorOverlay.errorCount',
      { count: totalErrorCount.value },
      totalErrorCount.value
    )
  )

  const multipleErrorCountLabel = computed(() =>
    t(
      'errorOverlay.multipleErrorCount',
      { count: totalErrorCount.value },
      totalErrorCount.value
    )
  )

  const singleOverlayCopy = computed(() =>
    singleErrorGroup.value
      ? resolveSingleOverlayCopy(singleErrorGroup.value)
      : undefined
  )

  const overlayMessage = computed(() => {
    if (hasMultipleErrors.value) {
      return t('errorOverlay.multipleErrorsMessage')
    }

    return singleOverlayCopy.value?.message ?? ''
  })

  const overlayTitle = computed(() =>
    hasMultipleErrors.value
      ? multipleErrorCountLabel.value
      : (singleOverlayCopy.value?.title ?? errorCountLabel.value)
  )

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

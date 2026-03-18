import { onBeforeUnmount, ref, watch } from 'vue'

import type { JobGroup } from '@/composables/queue/useJobList'

const DETAILS_SHOW_DELAY_MS = 200
const DETAILS_HIDE_DELAY_MS = 150

interface UseJobDetailsHoverOptions<TActive> {
  getActiveId: (active: TActive) => string
  getDisplayedJobGroups: () => JobGroup[]
  onReset?: () => void
}

export function useJobDetailsHover<TActive>({
  getActiveId,
  getDisplayedJobGroups,
  onReset
}: UseJobDetailsHoverOptions<TActive>) {
  const activeDetails = ref<TActive | null>(null)
  const hideTimer = ref<number | null>(null)
  const hideTimerJobId = ref<string | null>(null)
  const showTimer = ref<number | null>(null)

  function clearHideTimer() {
    if (hideTimer.value !== null) {
      clearTimeout(hideTimer.value)
      hideTimer.value = null
    }
    hideTimerJobId.value = null
  }

  function clearShowTimer() {
    if (showTimer.value !== null) {
      clearTimeout(showTimer.value)
      showTimer.value = null
    }
  }

  function clearHoverTimers() {
    clearHideTimer()
    clearShowTimer()
  }

  function resetActiveDetails() {
    clearHoverTimers()
    activeDetails.value = null
    onReset?.()
  }

  function hasDisplayedJob(jobId: string) {
    return getDisplayedJobGroups().some((group) =>
      group.items.some((item) => item.id === jobId)
    )
  }

  function scheduleDetailsShow(nextActive: TActive, onShow?: () => void) {
    const nextActiveId = getActiveId(nextActive)
    clearShowTimer()
    showTimer.value = window.setTimeout(() => {
      showTimer.value = null
      if (!hasDisplayedJob(nextActiveId)) return

      activeDetails.value = nextActive
      onShow?.()
    }, DETAILS_SHOW_DELAY_MS)
  }

  function scheduleDetailsHide(jobId?: string, onHide?: () => void) {
    if (!jobId) return

    clearShowTimer()
    if (hideTimerJobId.value && hideTimerJobId.value !== jobId) {
      return
    }

    clearHideTimer()
    hideTimerJobId.value = jobId
    hideTimer.value = window.setTimeout(() => {
      const currentActive = activeDetails.value
      if (currentActive && getActiveId(currentActive) === jobId) {
        activeDetails.value = null
        onHide?.()
      }
      hideTimer.value = null
      hideTimerJobId.value = null
    }, DETAILS_HIDE_DELAY_MS)
  }

  watch(getDisplayedJobGroups, () => {
    const currentActive = activeDetails.value
    if (!currentActive) return

    if (!hasDisplayedJob(getActiveId(currentActive))) {
      resetActiveDetails()
    }
  })

  onBeforeUnmount(resetActiveDetails)

  return {
    activeDetails,
    clearHoverTimers,
    resetActiveDetails,
    scheduleDetailsHide,
    scheduleDetailsShow
  }
}

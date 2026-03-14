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

  function scheduleDetailsShow(nextActive: TActive, onShow?: () => void) {
    clearShowTimer()
    showTimer.value = window.setTimeout(() => {
      activeDetails.value = nextActive
      showTimer.value = null
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

  watch(getDisplayedJobGroups, (groups) => {
    const currentActive = activeDetails.value
    if (!currentActive) return

    const activeId = getActiveId(currentActive)
    const hasActiveJob = groups.some((group) =>
      group.items.some((item) => item.id === activeId)
    )

    if (!hasActiveJob) {
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

import { promiseTimeout } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'

import { deploymentStatusTone } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/** Why the picked deployment cannot take a Run. */
export type UnreadyDeploymentReason =
  | 'stopped'
  | 'starting'
  | 'failed'
  | 'notReady'

function reasonFor(status: string): UnreadyDeploymentReason | null {
  const tone = deploymentStatusTone(status)
  if (tone === 'ready') return null
  if (tone === 'failed') return 'failed'
  if (tone === 'pending') return 'starting'
  return status === 'stopped' ? 'stopped' : 'notReady'
}

const READINESS_RECHECK_LIMIT_MS = 3000

let pendingRecheck: Promise<void> | undefined

function recheckListingOnce(): Promise<void> {
  pendingRecheck = Promise.race([
    useDeploymentPickStore().load(),
    promiseTimeout(READINESS_RECHECK_LIMIT_MS)
  ]).finally(() => {
    pendingRecheck = undefined
  })
  return pendingRecheck
}

/** Whether Run would reach a deployment that is not ready while the Run on menu is on screen to open instead. */
export function useUnreadyDeploymentRun() {
  const isSwitcherOffered = useDeploymentSwitcherOffered()
  const { isAppMode } = useAppMode()

  const isSwitcherOnScreen = computed(
    () =>
      isSwitcherOffered.value &&
      !isAppMode.value &&
      useDeploymentPickStore().switcherMounts > 0
  )

  const unreadyReason = computed(() => {
    if (!isSwitcherOnScreen.value) return null
    const picked = useDeploymentPickStore().pickedDeployment
    return picked === null ? null : reasonFor(picked.status)
  })

  function isRunBlocked(): boolean {
    return unreadyReason.value !== null
  }

  /**
   * Opens the Run on menu in place of a Run the deployment would refuse; false when Run may go ahead.
   * The listing is read again first. A Run made during that read, or one that no longer stands after it, is dropped.
   */
  async function openSwitcherInsteadOfRun(
    runStillStands: () => boolean
  ): Promise<boolean> {
    if (!isSwitcherOnScreen.value) return false
    if (pendingRecheck) return true
    if (!isRunBlocked()) return false
    const changedMeanwhile = shallowRef(false)
    const stopWatchingRun = watch(
      () => isSwitcherOnScreen.value && runStillStands(),
      () => {
        changedMeanwhile.value = true
      },
      { flush: 'sync', once: true }
    )
    await recheckListingOnce().finally(stopWatchingRun)
    if (changedMeanwhile.value || !runStillStands()) return true
    if (!isRunBlocked()) return false
    useDeploymentPickStore().requestSwitcherOpen()
    return true
  }

  return { unreadyReason, openSwitcherInsteadOfRun }
}

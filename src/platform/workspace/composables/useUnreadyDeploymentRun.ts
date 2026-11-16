import { computed } from 'vue'

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

const SETTLES_BY_ITSELF = new Set<UnreadyDeploymentReason>([
  'starting',
  'notReady'
])

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

  /**
   * Opens the Run on menu in place of a Run the deployment would refuse; false when Run may go ahead.
   * A status that settles by itself is read again first.
   */
  async function openSwitcherInsteadOfRun(): Promise<boolean> {
    const reasonAtClick = unreadyReason.value
    if (reasonAtClick === null) return false
    const store = useDeploymentPickStore()
    if (SETTLES_BY_ITSELF.has(reasonAtClick)) await store.load()
    if (unreadyReason.value === null) return false
    store.requestSwitcherOpen()
    return true
  }

  return { unreadyReason, openSwitcherInsteadOfRun }
}

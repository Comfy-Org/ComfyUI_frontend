import { computed } from 'vue'

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

/** Whether Run would reach a deployment that is not ready while a Run on menu is there to open instead. */
export function useUnreadyDeploymentRun() {
  const isSwitcherOffered = useDeploymentSwitcherOffered()

  const unreadyReason = computed(() => {
    if (!isSwitcherOffered.value) return null
    const { switcherMounts, pickedDeployment } = useDeploymentPickStore()
    if (switcherMounts === 0 || pickedDeployment === null) return null
    return reasonFor(pickedDeployment.status)
  })

  /** Opens the Run on menu in place of a Run the deployment would refuse; false when Run may go ahead. */
  function openSwitcherInsteadOfRun(): boolean {
    if (unreadyReason.value === null) return false
    useDeploymentPickStore().requestSwitcherOpen()
    return true
  }

  return { unreadyReason, openSwitcherInsteadOfRun }
}

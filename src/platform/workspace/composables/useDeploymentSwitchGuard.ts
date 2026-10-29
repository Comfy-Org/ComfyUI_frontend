import { storeToRefs } from 'pinia'

import { skipLeavePromptOnce } from '@/platform/workflow/management/leavePrompt'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/** What every deployment switch goes through before the page reloads. */
export function useDeploymentSwitchGuard() {
  const store = useDeploymentPickStore()
  const { deployments, isSwitching } = storeToRefs(store)
  const { deploymentFullLabel } = useDeploymentLabels()

  /** The name the save-before-switch dialog gives the deployment. */
  function targetLabel(deploymentId: string | null): string {
    return deploymentFullLabel(
      deployments.value.find(
        (deployment) => deployment.deployment_id === deploymentId
      ) ?? null
    )
  }

  /** Starts a switch whose reload skips the leave prompt; a refusal keeps it. */
  async function withoutLeavePrompt(
    start: () => Promise<string | null>
  ): Promise<string | null> {
    const keepLeavePrompt = skipLeavePromptOnce()
    const refusal = await start()
    if (!isSwitching.value) keepLeavePrompt()
    return refusal
  }

  return { targetLabel, withoutLeavePrompt }
}

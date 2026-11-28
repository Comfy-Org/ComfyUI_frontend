import { storeToRefs } from 'pinia'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { skipLeavePromptOnce } from '@/platform/workflow/management/leavePrompt'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { confirmUnsavedWorkBeforeSwitch } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

async function withoutLeavePrompt(
  start: () => Promise<string | null>
): Promise<string | null> {
  const keepLeavePrompt = skipLeavePromptOnce()
  const refusal = await start()
  if (!useDeploymentPickStore().isSwitching) keepLeavePrompt()
  return refusal
}

function landWhenAlreadyPicked(): void {
  const store = useDeploymentPickStore()
  if (store.isSwitching || store.changeSinceBoot === null) return
  const keepLeavePrompt = skipLeavePromptOnce()
  reloadForDeploymentSwitch(() => {
    keepLeavePrompt()
    void store.load()
  })
}

export async function switchToDeployment(
  deploymentId: string | null,
  label: string
): Promise<void> {
  if (!(await confirmUnsavedWorkBeforeSwitch(label))) return
  const refusal = await withoutLeavePrompt(() =>
    useDeploymentPickStore().pick(deploymentId)
  )
  if (refusal === null) {
    if (deploymentId === useDeploymentPickStore().pickedDeploymentId) {
      landWhenAlreadyPicked()
    }
    return
  }
  useToast().error(t('deploymentSwitcher.failedToSwitch'), {
    description: refusal,
    duration: 8000
  })
}

/** What every deployment switch goes through before the page reloads. */
export function useDeploymentSwitchGuard() {
  const store = useDeploymentPickStore()
  const { deployments, isSwitching } = storeToRefs(store)
  const { deploymentFullLabel, currentLabel } = useDeploymentLabels()

  function targetLabel(deploymentId: string | null): string {
    return deploymentFullLabel(
      deployments.value.find(
        (deployment) => deployment.deployment_id === deploymentId
      ) ?? null
    )
  }

  async function reloadOntoCurrent(
    confirm: typeof confirmUnsavedWorkBeforeSwitch = confirmUnsavedWorkBeforeSwitch
  ) {
    if (
      !(await confirm(currentLabel.value, { reload: true })) ||
      isSwitching.value
    )
      return
    skipLeavePromptOnce()
    reloadForDeploymentSwitch(() => void store.load())
  }

  return {
    targetLabel,
    withoutLeavePrompt,
    landWhenAlreadyPicked,
    reloadOntoCurrent
  }
}

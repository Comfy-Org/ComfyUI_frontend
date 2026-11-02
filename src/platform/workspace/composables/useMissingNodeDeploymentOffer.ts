import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentSwitchGuard } from '@/platform/workspace/composables/useDeploymentSwitchGuard'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { confirmUnsavedWorkBeforeSwitch } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

interface DeploymentChoice {
  deploymentId: string | null
  label: string
}

type MissingNodeDeploymentOffer =
  | { kind: 'none' }
  | { kind: 'choices'; choices: DeploymentChoice[] }

/** The deployments to offer where the editor reports missing nodes. */
export function useMissingNodeDeploymentOffer() {
  const { t } = useI18n()
  const pickStore = useDeploymentPickStore()
  const { deployments, pickedDeploymentId, isSwitching } =
    storeToRefs(pickStore)
  const { deploymentsThatRunIt, markFor } = useDeploymentCompatibility()
  const { deploymentFullLabel } = useDeploymentLabels()
  const switcherOffered = useDeploymentSwitcherOffered()
  const { targetLabel, withoutLeavePrompt } = useDeploymentSwitchGuard()

  function eachCheckedAndLacking() {
    return [null, ...deployments.value.map((d) => d.deployment_id)].every(
      (id) => markFor(id)?.kind === 'missing'
    )
  }

  const offer = computed<MissingNodeDeploymentOffer | null>(() => {
    const runIt = deploymentsThatRunIt.value
    if (!switcherOffered.value || runIt === null) return null
    if (runIt.length === 0) {
      return eachCheckedAndLacking() ? { kind: 'none' } : null
    }
    const choices = [
      { deploymentId: null, label: t('deploymentSwitcher.comfyCloud') },
      ...deployments.value.map((deployment) => ({
        deploymentId: deployment.deployment_id,
        label: deploymentFullLabel(deployment)
      }))
    ].filter(
      (choice) =>
        runIt.includes(choice.deploymentId) &&
        choice.deploymentId !== pickedDeploymentId.value
    )
    return choices.length > 0 ? { kind: 'choices', choices } : null
  })

  async function choose(deploymentId: string | null) {
    if (!(await confirmUnsavedWorkBeforeSwitch(targetLabel(deploymentId))))
      return
    const refusal = await withoutLeavePrompt(() => pickStore.pick(deploymentId))
    if (refusal === null) return
    useToast().error(t('deploymentSwitcher.failedToSwitch'), {
      description: refusal,
      duration: 8000
    })
  }

  return {
    offer,
    choose,
    isSwitching,
    openSwitcher: pickStore.requestSwitcherOpen
  }
}

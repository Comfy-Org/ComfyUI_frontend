import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

interface DeploymentChoice {
  deploymentId: string | null
  label: string
}

type MissingNodeDeploymentOffer =
  | { kind: 'none' }
  | { kind: 'choices'; choices: DeploymentChoice[] }

/**
 * The deployments to offer where the editor says the open workflow has
 * missing nodes (BE-19374): the side panel's missing-nodes message and the
 * error notice shown on open. Both read the one shared compatibility answer.
 */
export function useMissingNodeDeploymentOffer() {
  const { t } = useI18n()
  const pickStore = useDeploymentPickStore()
  const { deployments, pickedDeploymentId, isSwitching } =
    storeToRefs(pickStore)
  const { deploymentsThatRunIt, markFor } = useDeploymentCompatibility()
  const { deploymentLabel } = useDeploymentLabels()
  const switcherOffered = useDeploymentSwitcherOffered()

  function eachCheckedAndLacking() {
    return [null, ...deployments.value.map((d) => d.deployment_id)].every(
      (id) => markFor(id)?.kind === 'missing'
    )
  }

  /**
   * Nothing without an answer, "none" when Comfy Cloud and every listed
   * deployment were checked and each lacks a node type, else the ones to
   * offer, Comfy Cloud first. A deployment ingest could not check, or one the
   * answer leaves out, may have them all, so it rules out "none". The one
   * this browser runs on is never offered; when only it has them all, there
   * is nothing to say.
   */
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
        label: deploymentLabel(deployment)
      }))
    ].filter(
      (choice) =>
        runIt.includes(choice.deploymentId) &&
        choice.deploymentId !== pickedDeploymentId.value
    )
    return choices.length > 0 ? { kind: 'choices', choices } : null
  })

  async function choose(deploymentId: string | null) {
    const refusal = await pickStore.pick(deploymentId)
    if (refusal === null) return
    useToastStore().add({
      severity: 'error',
      summary: t('deploymentSwitcher.failedToSwitch'),
      detail: refusal,
      life: 8000
    })
  }

  return {
    offer,
    choose,
    isSwitching,
    openSwitcher: pickStore.requestSwitcherOpen
  }
}

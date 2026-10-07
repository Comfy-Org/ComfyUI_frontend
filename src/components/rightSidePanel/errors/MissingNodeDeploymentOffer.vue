<!-- Under the missing-nodes message, the workspace's deployments that have
     every node type the open workflow uses, Comfy Cloud included, each a
     button that picks it through the deployment switcher (BE-19374). Up to
     three are named; "and N more" opens the switcher. When each was checked
     and none has them all, it says so. Renders nothing where the user popover
     does not offer the switcher (useDeploymentSwitcherOffered), where the
     deployment listing hides it, or before the check answers. -->
<template>
  <div
    v-if="offer !== null"
    class="pb-3"
    data-testid="missing-node-deployment-offer"
  >
    <p
      v-if="offer.kind === 'none'"
      class="m-0 text-xs/relaxed text-muted-foreground"
    >
      {{ t('rightSidePanel.missingNodePacks.noDeploymentRunsIt') }}
    </p>
    <div v-else class="flex flex-wrap items-center gap-1.5">
      <span class="text-xs text-muted-foreground">
        {{ t('rightSidePanel.missingNodePacks.runsOn') }}
      </span>
      <Button
        v-for="choice in offer.choices.slice(0, NAMED)"
        :key="choice.deploymentId ?? 'comfy-cloud'"
        variant="secondary"
        size="sm"
        :disabled="isSwitching"
        @click="choose(choice.deploymentId)"
      >
        {{ choice.label }}
      </Button>
      <Button
        v-if="offer.choices.length > NAMED"
        variant="muted-textonly"
        size="sm"
        @click="pickStore.requestSwitcherOpen()"
      >
        {{
          t('rightSidePanel.missingNodePacks.andMore', {
            count: offer.choices.length - NAMED
          })
        }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const NAMED = 3

const { t } = useI18n()
const pickStore = useDeploymentPickStore()
const { deployments, pickedDeploymentId, isSwitching } = storeToRefs(pickStore)
const { deploymentsThatRunIt, markFor } = useDeploymentCompatibility()
const { deploymentLabel } = useDeploymentLabels()
const switcherOffered = useDeploymentSwitcherOffered()

function eachCheckedAndLacking() {
  return [null, ...deployments.value.map((d) => d.deployment_id)].every(
    (id) => markFor(id)?.kind === 'missing'
  )
}

/**
 * What to say under the message: nothing without an answer, "none" when
 * Comfy Cloud and every listed deployment were checked and each lacks a node
 * type, else the ones to offer. A deployment ingest could not check, or one
 * the answer leaves out, may have them all, so it rules out "none". The one
 * this browser runs on is never offered; when only it has them all, there is
 * nothing to say.
 */
const offer = computed(() => {
  const runIt = deploymentsThatRunIt.value
  if (!switcherOffered.value || runIt === null) return null
  if (runIt.length === 0) {
    return eachCheckedAndLacking() ? { kind: 'none' as const } : null
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
  return choices.length > 0 ? { kind: 'choices' as const, choices } : null
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
</script>

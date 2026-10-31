<template>
  <div
    v-if="first"
    class="flex w-full items-center gap-2 pr-8"
    data-testid="error-overlay-deployment-offer"
  >
    <span class="size-4 shrink-0" aria-hidden="true" />
    <span class="min-w-0 flex-1 truncate text-sm text-foreground">
      {{ t('errorOverlay.runsOn', { deployment: first.label }) }}
    </span>
    <Button
      v-if="moreCount > 0"
      variant="muted-textonly"
      size="unset"
      class="min-h-8 shrink-0 rounded-lg px-2 py-2 text-xs font-normal"
      @click="openSwitcher()"
    >
      {{ t('errorOverlay.moreDeployments', { count: moreCount }) }}
    </Button>
    <Button
      variant="secondary"
      size="unset"
      class="min-h-8 shrink-0 rounded-lg px-3 py-2 text-xs font-normal"
      :disabled="isSwitching"
      @click="choose(first.deploymentId)"
    >
      {{ t('errorOverlay.switchDeployment') }}
    </Button>
  </div>
  <div
    v-else-if="customDeploymentOffered"
    class="flex w-full items-center gap-2 pr-8"
    data-testid="error-overlay-custom-deployment-offer"
  >
    <span class="size-4 shrink-0" aria-hidden="true" />
    <span class="min-w-0 flex-1 truncate text-sm text-foreground">
      {{ t('errorOverlay.runOnCustomDeployment') }}
    </span>
    <Button
      variant="secondary"
      size="unset"
      class="min-h-8 shrink-0 rounded-lg px-3 py-2 text-xs font-normal"
      @click="openWorkflowNeedsDeploymentDialog()"
    >
      {{ t('errorOverlay.setUpCustomDeployment') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { useMissingNodeDeploymentOffer } from '@/platform/workspace/composables/useMissingNodeDeploymentOffer'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const { t } = useI18n()
const { offer, choose, isSwitching, openSwitcher } =
  useMissingNodeDeploymentOffer()
const pickStore = useDeploymentPickStore()
const missingNodesErrorStore = useMissingNodesErrorStore()
const switcherOffered = useDeploymentSwitcherOffered()

const choices = computed(() =>
  offer.value?.kind === 'choices' ? offer.value.choices : []
)
const first = computed(() => choices.value[0])
const moreCount = computed(() => choices.value.length - 1)

const customDeploymentOffered = computed(
  () =>
    switcherOffered.value &&
    pickStore.isVisible &&
    pickStore.bootDeployment === null &&
    nodesNeedingDeployment(
      missingNodesErrorStore.missingNodesError?.nodeTypes ?? []
    ).length > 0
)
</script>

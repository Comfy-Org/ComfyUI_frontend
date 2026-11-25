<template>
  <div
    v-if="first && !deploymentDialogAppeared"
    class="flex w-full items-center gap-2"
    data-testid="error-overlay-deployment-offer"
  >
    <span class="size-5 shrink-0" aria-hidden="true" />
    <span class="min-w-0 flex-1 truncate text-sm text-foreground">
      {{ t('errorOverlay.runsOn', { deployment: first.label }) }}
    </span>
    <Button
      v-if="moreCount > 0"
      variant="muted-textonly"
      size="sm"
      class="shrink-0"
      @click="openSwitcher()"
    >
      {{ t('errorOverlay.moreDeployments', { count: moreCount }) }}
    </Button>
    <Button
      variant="secondary"
      size="sm"
      class="shrink-0"
      :disabled="isSwitching"
      @click="choose(first.deploymentId)"
    >
      {{ t('errorOverlay.switchDeployment') }}
    </Button>
  </div>
  <div
    v-else-if="customDeploymentOffered && !deploymentDialogAppeared"
    class="flex w-full items-center gap-2"
    data-testid="error-overlay-custom-deployment-offer"
  >
    <span class="size-5 shrink-0" aria-hidden="true" />
    <span class="min-w-0 flex-1 truncate text-sm text-foreground">
      {{ t('errorOverlay.runOnCustomDeployment') }}
    </span>
    <Button
      variant="secondary"
      size="sm"
      class="shrink-0"
      @click="setUpCustomDeployment"
    >
      {{ t('errorOverlay.setUpCustomDeployment') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useCustomDeploymentOffered } from '@/platform/workspace/composables/useCustomDeploymentOffered'
import { useMissingNodeDeploymentOffer } from '@/platform/workspace/composables/useMissingNodeDeploymentOffer'
import {
  isWorkflowNeedsDeploymentDialogOpen,
  openWorkflowNeedsDeploymentDialog
} from '@/platform/workspace/openCustomDeploymentDialog'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { NEW_DEPLOYMENT_FOR_WORKFLOW } from '@/platform/workspace/platformFrame/platformFrameWaysIn'

const { t } = useI18n()
const { offer, choose, isSwitching, openSwitcher } =
  useMissingNodeDeploymentOffer()
const customDeploymentOffered = useCustomDeploymentOffered(
  () => offer.value?.kind === 'none'
)
const deploymentDialogAppeared = ref(false)
whenever(
  isWorkflowNeedsDeploymentDialogOpen,
  () => {
    deploymentDialogAppeared.value = true
  },
  { immediate: true }
)

const choices = computed(() =>
  offer.value?.kind === 'choices' ? offer.value.choices : []
)
const first = computed(() => choices.value[0])
const moreCount = computed(() => choices.value.length - 1)

function setUpCustomDeployment() {
  if (usePlatformFrameStore().open(NEW_DEPLOYMENT_FOR_WORKFLOW, 'set_up'))
    return
  void openWorkflowNeedsDeploymentDialog()
}
</script>

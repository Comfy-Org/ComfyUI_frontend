<template>
  <Button
    variant="secondary"
    size="icon"
    :tooltip
    tooltip-side="bottom"
    :aria-label="tooltip"
    :aria-busy="isChecking || isOpeningAgent || undefined"
    data-testid="cloud-button"
    @pointerenter="prefetch"
    @keydown.enter="prefetch"
    @keydown.space="prefetch"
    @click="openCloud"
  >
    <ProgressRing v-if="isChecking" :percent="25" class="size-4 animate-spin" />
    <i v-else class="icon-[lucide--cloud]" aria-hidden="true" />
  </Button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useToast } from '@/components/ui/toast/toastStore'
import ProgressRing from '@/platform/openOnCloud/components/ProgressRing.vue'
import {
  closeRunOnCloudDialog,
  openRunOnCloudDialog
} from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useOpenAgentPanel } from '@/workbench/extensions/agent/composables/agent/useOpenAgentPanel'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const { t } = useI18n()
const toast = useToast()
const checkStore = useCloudWorkflowCheckStore()
const { state: check } = storeToRefs(checkStore)
const agentPanelStore = useAgentPanelStore()
const { isOpening: isOpeningAgent, open: openAgent } =
  useOpenAgentPanel('cloud_button')

const isChecking = computed(
  () => !agentPanelStore.enabled && check.value.phase === 'checking'
)
const opensWhenAnswered = ref(false)
let isMounted = true
onBeforeUnmount(() => {
  isMounted = false
})

const tooltip = computed(() =>
  isChecking.value
    ? t('openOnCloud.cloudButton.checking')
    : t('openOnCloud.cloudButton.tooltip')
)

function prefetch() {
  if (agentPanelStore.enabled) return
  if (check.value.phase === 'idle') void checkStore.check()
}

async function openCloud() {
  if (isOpeningAgent.value) return
  if (!agentPanelStore.enabled) {
    openModal()
    return
  }
  opensWhenAnswered.value = false
  closeRunOnCloudDialog()
  await openAgent()
}

function showModal() {
  const current = check.value
  if (current.phase === 'failed') {
    toast.error(t('openOnCloud.checkFailed'))
    return
  }
  void openRunOnCloudDialog(
    () => isMounted && !agentPanelStore.enabled && check.value === current
  )
}

function openModal() {
  const { phase } = check.value
  if (phase === 'answered') {
    showModal()
    return
  }
  opensWhenAnswered.value = true
  if (phase === 'idle' || phase === 'failed') void checkStore.check()
}

watch(
  () => check.value.phase,
  (phase) => {
    if (phase === 'idle') {
      opensWhenAnswered.value = false
      closeRunOnCloudDialog()
      return
    }
    if (phase === 'checking') {
      if (closeRunOnCloudDialog()) opensWhenAnswered.value = true
      return
    }
    if (!opensWhenAnswered.value) return
    opensWhenAnswered.value = false
    showModal()
  }
)
</script>

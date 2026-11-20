<template>
  <Button
    variant="secondary"
    size="icon"
    :tooltip
    tooltip-side="bottom"
    :aria-label="tooltip"
    :aria-busy="isChecking || undefined"
    data-testid="cloud-button"
    @pointerenter="prefetch"
    @keydown.enter="prefetch"
    @keydown.space="prefetch"
    @click="openModal"
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
import { useTelemetry } from '@comfyorg/telemetry'
import ProgressRing from '@/platform/openOnCloud/components/ProgressRing.vue'
import type { CloudWorkflowBlocker } from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  closeRunOnCloudDialog,
  openRunOnCloudDialog
} from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'

const { t } = useI18n()
const toast = useToast()
const checkStore = useCloudWorkflowCheckStore()
const { state: check } = storeToRefs(checkStore)

const isChecking = computed(() => check.value.phase === 'checking')
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
  if (check.value.phase === 'idle') void checkStore.check()
}

function failureMessage(blocker: CloudWorkflowBlocker | null): string {
  switch (blocker?.kind) {
    case 'emptyWorkflow':
      return t('openOnCloud.emptyWorkflow')
    case 'unreadableModelLoader':
      return t('openOnCloud.missingLocalModelLoader', {
        nodeType: blocker.nodeType
      })
    case undefined:
      return t('openOnCloud.checkFailed')
  }
}

function showModal() {
  const current = check.value
  if (current.phase === 'failed') {
    toast.error(failureMessage(current.blocker))
    return
  }
  void openRunOnCloudDialog(() => isMounted && check.value === current)
}

function openModal() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'run_bar_cloud_clicked',
    element_group: 'top_menu'
  })
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

<template>
  <Button
    variant="secondary"
    size="icon"
    :tooltip="
      isChecking ? buttonLabel : t('openOnCloud.cloudButton.checkTooltip')
    "
    tooltip-side="bottom"
    :aria-label="buttonLabel"
    :aria-busy="isChecking || undefined"
    data-testid="cloud-button"
    @click="openModal"
  >
    <ProgressRing v-if="isChecking" :percent="25" class="size-4 animate-spin" />
    <i v-else class="icon-[lucide--cloud]" aria-hidden="true" />
  </Button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, watch } from 'vue'
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
let isMounted = true
onBeforeUnmount(() => {
  isMounted = false
  closeRunOnCloudDialog()
})

const buttonLabel = computed(() =>
  isChecking.value
    ? t('openOnCloud.cloudButton.checking')
    : t('openOnCloud.cloudButton.tooltip')
)

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

function openModal() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'run_bar_cloud_clicked',
    element_group: 'top_menu'
  })
  if (isChecking.value) return
  void openRunOnCloudDialog(() => isMounted, { requestCheck })
}

function requestCheck(): boolean {
  if (!isMounted || isChecking.value) return false
  void checkStore.check()
  return true
}

watch(check, (current) => {
  if (current.phase === 'idle') {
    closeRunOnCloudDialog()
    return
  }
  if (current.phase === 'failed' && closeRunOnCloudDialog()) {
    toast.error(failureMessage(current.blocker))
  }
})
</script>

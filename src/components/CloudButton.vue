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
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { useToast } from '@/components/ui/toast/toastStore'
import { useTelemetry } from '@comfyorg/telemetry'
import ProgressRing from '@/platform/openOnCloud/components/ProgressRing.vue'
import type { CloudWorkflowBlocker } from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  closeRunOnCloudDialog,
  openRunOnCloudDialog
} from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'

import { useDialogStore } from '@/stores/dialogStore'

const CHECK_DIALOG_KEY = 'global-check-cloud-compatibility'

const { t } = useI18n()
const dialogs = useDialogStore()
const toast = useToast()
const checkStore = useCloudWorkflowCheckStore()
const { state: check } = storeToRefs(checkStore)

const isChecking = computed(() => check.value.phase === 'checking')
const opensWhenAnswered = ref(false)
let isMounted = true
onBeforeUnmount(() => {
  isMounted = false
  dialogs.closeDialog({ key: CHECK_DIALOG_KEY })
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
  if (isChecking.value) return
  const close = () => dialogs.closeDialog({ key: CHECK_DIALOG_KEY })
  showConfirmDialog({
    key: CHECK_DIALOG_KEY,
    headerProps: { title: t('openOnCloud.cloudButton.tooltip') },
    props: {
      promptText: t('openOnCloud.cloudButton.checkDisclosure'),
      preserveNewlines: true
    },
    footerProps: {
      cancelText: t('g.cancel'),
      confirmText: t('openOnCloud.cloudButton.check'),
      confirmVariant: 'primary',
      onCancel: close,
      onConfirm: () => {
        close()
        if (!isMounted || isChecking.value) return
        opensWhenAnswered.value = true
        void checkStore.check()
      }
    }
  })
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

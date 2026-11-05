<template>
  <Button
    variant="secondary"
    size="icon"
    :tooltip
    tooltip-side="bottom"
    :aria-label="tooltip"
    :aria-busy="isChecking || undefined"
    data-testid="cloud-button"
    @pointerenter="checkWorkflow"
    @keydown.enter="checkWorkflow"
    @keydown.space="checkWorkflow"
    @click="openModal"
  >
    <ProgressRing v-if="isChecking" :percent="25" class="size-4 animate-spin" />
    <i v-else class="icon-[lucide--cloud]" aria-hidden="true" />
  </Button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useToast } from '@/components/ui/toast/toastStore'
import { useErrorHandling } from '@/composables/useErrorHandling'
import ProgressRing from '@/platform/openOnCloud/components/ProgressRing.vue'
import {
  closeRunOnCloudDialog,
  openRunOnCloudDialog
} from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'

const { t } = useI18n()
const toast = useToast()
const { toastErrorHandler } = useErrorHandling()
const checkStore = useCloudWorkflowCheckStore()
const { state: check } = storeToRefs(checkStore)

const isChecking = computed(() => check.value.phase === 'checking')
const opensWhenAnswered = ref(false)

const tooltip = computed(() =>
  isChecking.value
    ? t('openOnCloud.cloudButton.checking')
    : t('openOnCloud.cloudButton.tooltip')
)

function checkWorkflow() {
  if (!isChecking.value) void checkStore.check()
}

function showModal() {
  if (check.value.phase === 'failed') {
    toast.error(t('openOnCloud.checkFailed'))
    return
  }
  openRunOnCloudDialog().catch(toastErrorHandler)
}

function openModal() {
  opensWhenAnswered.value = true
  checkWorkflow()
}

watch(
  () => check.value.phase,
  (phase) => {
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

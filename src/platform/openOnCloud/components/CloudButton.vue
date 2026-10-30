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
  <CloudCheckPrototypeSwitch v-if="isDevBuild" />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useErrorHandling } from '@/composables/useErrorHandling'
import CloudCheckPrototypeSwitch from '@/platform/openOnCloud/components/CloudCheckPrototypeSwitch.vue'
import ProgressRing from '@/platform/openOnCloud/components/ProgressRing.vue'
import {
  closeRunOnCloudDialog,
  openRunOnCloudDialog
} from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'

const isDevBuild = import.meta.env.DEV

const { t } = useI18n()
const { toastErrorHandler } = useErrorHandling()
const store = useCloudWorkflowCheckStore()
const { state, isModalShown } = storeToRefs(store)

const isChecking = computed(() => state.value.phase === 'checking')
const tooltip = computed(() =>
  isChecking.value
    ? t('openOnCloud.cloudButton.checking')
    : t('openOnCloud.cloudButton.tooltip')
)

function checkWorkflow() {
  if (!isChecking.value) void store.check()
}

function openModal() {
  if (state.value.phase === 'idle') checkWorkflow()
  store.requestModal()
}

function showModal() {
  openRunOnCloudDialog().catch((error: unknown) => {
    store.dismissModal()
    toastErrorHandler(error)
  })
}

watch(
  isModalShown,
  (shown) => {
    if (shown) showModal()
    else closeRunOnCloudDialog()
  },
  { immediate: true }
)
</script>

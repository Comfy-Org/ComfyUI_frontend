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
    <ProgressRing
      v-if="modal.kind === 'uploading'"
      :percent="modal.percent"
      class="size-4"
    />
    <ProgressRing
      v-else-if="isChecking"
      :percent="25"
      class="size-4 animate-spin"
    />
    <i v-else class="icon-[lucide--cloud]" aria-hidden="true" />
  </Button>
  <CloudCheckPrototypeSwitch v-if="isDevBuild" />
  <AgentEnsuesOverlay />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useErrorHandling } from '@/composables/useErrorHandling'
import AgentEnsuesOverlay from '@/platform/openOnCloud/components/AgentEnsuesOverlay.vue'
import CloudCheckPrototypeSwitch from '@/platform/openOnCloud/components/CloudCheckPrototypeSwitch.vue'
import ProgressRing from '@/platform/openOnCloud/components/ProgressRing.vue'
import {
  closeRunOnCloudDialog,
  openRunOnCloudDialog
} from '@/platform/openOnCloud/openRunOnCloudDialog'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { serializeRootGraph } from '@/platform/openOnCloud/serializeRootGraph'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useLocalSignInStore } from '@/platform/openOnCloud/stores/localSignInStore'
import { useModelUploadStore } from '@/platform/openOnCloud/stores/modelUploadStore'

const isDevBuild = import.meta.env.DEV

const { t } = useI18n()
const { toastErrorHandler } = useErrorHandling()
const checkStore = useCloudWorkflowCheckStore()
const { state: check } = storeToRefs(checkStore)
const { state: upload } = storeToRefs(useModelUploadStore())
const { signedIn } = storeToRefs(useLocalSignInStore())

const modal = computed(() =>
  runOnCloudModalState(check.value, upload.value, {
    signedIn: signedIn.value
  })
)
const isChecking = computed(
  () => modal.value.kind === 'checking' && check.value.phase === 'checking'
)
const opensWhenAnswered = ref(false)

const tooltip = computed(() => {
  if (modal.value.kind === 'uploading')
    return t('openOnCloud.cloudButton.uploading', {
      models: t('openOnCloud.cloudButton.models', modal.value.models.length),
      percent: modal.value.percent
    })
  return isChecking.value
    ? t('openOnCloud.cloudButton.checking')
    : t('openOnCloud.cloudButton.tooltip')
})

function checkWorkflow() {
  if (check.value.phase === 'checking') return
  const workflow = serializeRootGraph()
  if (workflow) void checkStore.check(workflow)
}

function showModal() {
  openRunOnCloudDialog().catch(toastErrorHandler)
}

function openModal() {
  if (check.value.phase === 'idle') checkWorkflow()
  if (modal.value.kind === 'checking') opensWhenAnswered.value = true
  else showModal()
}

watch(
  () => modal.value.kind,
  (kind) => {
    if (kind === 'checking') {
      if (closeRunOnCloudDialog()) opensWhenAnswered.value = true
      return
    }
    if (!opensWhenAnswered.value) return
    opensWhenAnswered.value = false
    showModal()
  }
)
</script>

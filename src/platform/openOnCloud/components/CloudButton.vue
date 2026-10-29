<template>
  <Button
    variant="secondary"
    size="icon"
    :tooltip
    tooltip-side="bottom"
    :aria-label="tooltip"
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
    <i v-else class="icon-[lucide--cloud]" aria-hidden="true" />
  </Button>
  <CloudCheckPrototypeSwitch v-if="isDevBuild" />
  <AgentEnsuesOverlay />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useErrorHandling } from '@/composables/useErrorHandling'
import AgentEnsuesOverlay from '@/platform/openOnCloud/components/AgentEnsuesOverlay.vue'
import CloudCheckPrototypeSwitch from '@/platform/openOnCloud/components/CloudCheckPrototypeSwitch.vue'
import ProgressRing from '@/platform/openOnCloud/components/ProgressRing.vue'
import { openRunOnCloudDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { serializeRootGraph } from '@/platform/openOnCloud/serializeRootGraph'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useModelUploadStore } from '@/platform/openOnCloud/stores/modelUploadStore'

const isDevBuild = import.meta.env.DEV

const { t } = useI18n()
const { toastErrorHandler } = useErrorHandling()
const checkStore = useCloudWorkflowCheckStore()
const { state: check } = storeToRefs(checkStore)
const { state: upload } = storeToRefs(useModelUploadStore())

const modal = computed(() => runOnCloudModalState(check.value, upload.value))

const tooltip = computed(() =>
  modal.value.kind === 'uploading'
    ? t('openOnCloud.cloudButton.uploading', {
        models: t('openOnCloud.cloudButton.models', modal.value.models.length),
        percent: modal.value.percent
      })
    : t('openOnCloud.cloudButton.tooltip')
)

function checkWorkflow() {
  if (check.value.phase === 'checking') return
  const workflow = serializeRootGraph()
  if (workflow) void checkStore.check(workflow)
}

function openModal() {
  openRunOnCloudDialog().catch(toastErrorHandler)
}
</script>

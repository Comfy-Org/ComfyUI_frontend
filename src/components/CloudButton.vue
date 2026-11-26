<template>
  <Button
    v-if="showCloudAction || isUploading"
    variant="secondary"
    size="icon"
    :tooltip="buttonLabel"
    tooltip-side="bottom"
    :aria-label="buttonLabel"
    :aria-busy="isChecking || undefined"
    data-testid="cloud-button"
    @click="openModal"
  >
    <ProgressRing
      v-if="isUploading"
      :percent="uploadPercent"
      class="size-4"
      data-testid="cloud-button-upload-progress"
    />
    <ProgressRing
      v-else-if="isChecking"
      :percent="25"
      class="size-4 animate-spin"
    />
    <i v-else class="icon-[lucide--cloud]" aria-hidden="true" />
  </Button>
  <DropdownMenuRoot
    v-if="recoverableModels && recoverableBatches.length > 1"
    :modal="false"
  >
    <DropdownMenuTrigger as-child>
      <Button
        variant="secondary"
        size="icon"
        :tooltip="t('openOnCloud.cloudButton.resumeUpload')"
        :aria-label="t('openOnCloud.cloudButton.resumeUpload')"
        tooltip-side="bottom"
        data-testid="cloud-upload-recovery-button"
      >
        <i class="icon-[lucide--rotate-ccw]" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <MenuContent side="bottom" align="end" :side-offset="4">
      <MenuItem
        v-for="models in recoverableBatches"
        :key="JSON.stringify(models.map(modelKey))"
        @select="openUploadBatch(models)"
      >
        <span class="truncate">{{
          models.map((model) => model.name).join(', ')
        }}</span>
      </MenuItem>
    </MenuContent>
  </DropdownMenuRoot>
  <Button
    v-else-if="recoverableModels"
    variant="secondary"
    size="icon"
    :tooltip="$t('openOnCloud.cloudButton.resumeUpload')"
    :aria-label="$t('openOnCloud.cloudButton.resumeUpload')"
    tooltip-side="bottom"
    data-testid="cloud-upload-recovery-button"
    @click="openUploadBatch(recoverableModels)"
  >
    <i class="icon-[lucide--rotate-ccw]" aria-hidden="true" />
  </Button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import MenuContent from '@comfyorg/design-system/menu/MenuContent'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTelemetry } from '@comfyorg/telemetry'
import type { RunOnCloudTelemetryEvent } from '@comfyorg/telemetry/types'
import ProgressRing from '@/platform/openOnCloud/components/ProgressRing.vue'
import type { CloudWorkflowBlocker } from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  closeRunOnCloudDialog,
  openRunOnCloudDialog
} from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import {
  modelKey,
  useLocalModelUploadStore
} from '@/platform/openOnCloud/stores/localModelUploadStore'
import type { MissingModel } from '@/platform/openOnCloud/stores/localModelUploadStore'

const { t } = useI18n()
const { showCloudAction = true } = defineProps<{ showCloudAction?: boolean }>()
const { flags } = useFeatureFlags()
const toast = useToast()
const checkStore = useCloudWorkflowCheckStore()
const { state: check } = storeToRefs(checkStore)
const uploads = useLocalModelUploadStore()
const {
  isUploading,
  activeModels,
  owner,
  retryBatches,
  percent: uploadPercent
} = storeToRefs(uploads)

function canRecoverBatch(models: MissingModel[]): boolean {
  return flags.openOnCloudModelUploadEnabled || uploads.canFinish(models)
}

const recoverableBatches = computed(() =>
  retryBatches.value.filter(canRecoverBatch)
)
const recoverableModels = computed(() => {
  if (isUploading.value) return undefined
  return flags.openOnCloudModelUploadEnabled
    ? activeModels.value
    : recoverableBatches.value[0]
})
const isChecking = computed(() => check.value.phase === 'checking')
let isMounted = true
onBeforeUnmount(() => {
  isMounted = false
  closeRunOnCloudDialog()
})

const buttonLabel = computed(() => {
  if (isUploading.value)
    return t('openOnCloud.cloudButton.uploading', {
      percent: uploadPercent.value
    })
  return isChecking.value
    ? t('openOnCloud.cloudButton.checking')
    : t('openOnCloud.cloudButton.tooltip')
})

type CheckFailureProperties = Extract<
  RunOnCloudTelemetryEvent,
  { name: 'app:run_on_cloud_check_failed' }
>['properties']

function checkFailure(blocker: CloudWorkflowBlocker | null): {
  message: string
  properties: CheckFailureProperties
} {
  switch (blocker?.kind) {
    case 'emptyWorkflow':
      return {
        message: t('openOnCloud.emptyWorkflow'),
        properties: { reason: 'empty_workflow' }
      }
    case 'unreadableModelLoader':
      return {
        message: t('openOnCloud.missingLocalModelLoader', {
          nodeType: blocker.nodeType
        }),
        properties: {
          reason: 'unreadable_model_loader',
          node_type: blocker.nodeType
        }
      }
    case undefined:
      return {
        message: t('openOnCloud.checkFailed'),
        properties: { reason: 'no_verdict' }
      }
  }
}

function openModal() {
  if (!showCloudAction && !isUploading.value) return
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'run_bar_cloud_clicked',
    element_group: 'top_menu'
  })
  if (isUploading.value) {
    openUploadBatch(activeModels.value)
    return
  }
  if (isChecking.value) return
  void openRunOnCloudDialog(
    () => isMounted && showCloudAction && !isUploading.value,
    { requestCheck }
  )
}

function requestCheck(signal: AbortSignal): boolean {
  if (!isMounted || isChecking.value || !showCloudAction || isUploading.value)
    return false
  void checkStore.check({
    refreshUploadGrant:
      !flags.openOnCloudModelUploadEnabled && retryBatches.value.length > 0,
    canRequest: () => isMounted && showCloudAction && !isUploading.value,
    signal
  })
  return true
}

function openUploadBatch(models: MissingModel[] | undefined) {
  if (!models || (!isUploading.value && !canRecoverBatch(models))) return
  const uploadBatch = { models, owner: owner.value }
  void openRunOnCloudDialog(
    () =>
      isMounted &&
      (isUploading.value || canRecoverBatch(models)) &&
      owner.value === uploadBatch.owner &&
      (activeModels.value === models || retryBatches.value.includes(models)),
    { uploadBatch }
  )
}

watch([check, isUploading], ([current, uploading]) => {
  if (uploading) return
  if (current.phase === 'idle') {
    closeRunOnCloudDialog({ keepUploadBatch: true })
    return
  }
  if (
    current.phase === 'failed' &&
    closeRunOnCloudDialog({ keepUploadBatch: true })
  ) {
    const { message, properties } = checkFailure(current.blocker)
    useTelemetry()?.trackRunOnCloudEvent({
      name: 'app:run_on_cloud_check_failed',
      properties
    })
    toast.error(message)
  }
})
</script>

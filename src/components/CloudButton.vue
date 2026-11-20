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
    <ProgressRing
      v-if="hasUploadInProgress"
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
  <DropdownMenuRoot v-if="canRecover && retryBatches.length > 1" :modal="false">
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
        v-for="models in retryBatches"
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
    v-else-if="canRecover"
    variant="secondary"
    size="icon"
    :tooltip="$t('openOnCloud.cloudButton.resumeUpload')"
    :aria-label="$t('openOnCloud.cloudButton.resumeUpload')"
    tooltip-side="bottom"
    data-testid="cloud-upload-recovery-button"
    @click="openUploadBatch(activeModels)"
  >
    <i class="icon-[lucide--rotate-ccw]" aria-hidden="true" />
  </Button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import MenuContent from '@comfyorg/design-system/menu/MenuContent'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTelemetry } from '@comfyorg/telemetry'
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
const { flags } = useFeatureFlags()
const toast = useToast()
const checkStore = useCloudWorkflowCheckStore()
const { state: check } = storeToRefs(checkStore)
const {
  isUploading,
  activeModels,
  owner,
  retryBatches,
  percent: uploadPercent
} = storeToRefs(useLocalModelUploadStore())

const hasUploadInProgress = computed(
  () => flags.openOnCloudModelUploadEnabled && isUploading.value
)
const canRecover = computed(
  () =>
    flags.openOnCloudModelUploadEnabled &&
    !isUploading.value &&
    !!activeModels.value
)
const isChecking = computed(() => check.value.phase === 'checking')
const opensWhenAnswered = ref(false)
let isMounted = true
onBeforeUnmount(() => {
  isMounted = false
  closeRunOnCloudDialog()
})

const tooltip = computed(() => {
  if (hasUploadInProgress.value)
    return t('openOnCloud.cloudButton.uploading', {
      percent: uploadPercent.value
    })
  return isChecking.value
    ? t('openOnCloud.cloudButton.checking')
    : t('openOnCloud.cloudButton.tooltip')
})

function prefetch() {
  if (!hasUploadInProgress.value && check.value.phase === 'idle')
    void checkStore.check()
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
  if (hasUploadInProgress.value) {
    openUploadBatch(activeModels.value)
    return
  }
  const { phase } = check.value
  if (phase === 'answered') {
    showModal()
    return
  }
  opensWhenAnswered.value = true
  if (phase === 'idle' || phase === 'failed') void checkStore.check()
}

function openUploadBatch(models: MissingModel[] | undefined) {
  if (!flags.openOnCloudModelUploadEnabled || !models) return
  const uploadBatch = { models, owner: owner.value }
  void openRunOnCloudDialog(
    () =>
      isMounted &&
      flags.openOnCloudModelUploadEnabled &&
      owner.value === uploadBatch.owner &&
      (activeModels.value === models || retryBatches.value.includes(models)),
    { uploadBatch }
  )
}

watch(
  () => check.value.phase,
  (phase) => {
    if (hasUploadInProgress.value) return
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

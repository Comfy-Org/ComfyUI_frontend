<template>
  <BaseModalLayout
    :content-title="$t('comfyHubPublish.title')"
    content-padding="none"
    left-panel-width="16.5rem"
    size="md"
  >
    <template #leftPanelHeaderTitle>
      <h2 class="flex-1 text-base font-semibold select-none">
        {{ $t('comfyHubPublish.title') }}
      </h2>
    </template>

    <template #leftPanel>
      <ComfyHubPublishNav :current-step @step-click="goToStep" />
    </template>

    <template #header />
    <template #content>
      <ComfyHubPublishWizardContent
        :current-step
        :form-data
        :is-first-step
        :is-last-step
        :is-publishing
        :on-update-form-data="updateFormData"
        :on-go-next="goNext"
        :on-go-back="goBack"
        :on-cancel="onClose"
        :on-require-profile="handleRequireProfile"
        :on-gate-complete="handlePublishGateComplete"
        :on-gate-close="handlePublishGateClose"
        :on-publish="handlePublish"
      />
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref } from 'vue'

import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import ComfyHubPublishNav from '@/platform/workflow/sharing/components/publish/ComfyHubPublishNav.vue'
import ComfyHubPublishWizardContent from '@/platform/workflow/sharing/components/publish/ComfyHubPublishWizardContent.vue'
import { useComfyHubPublishSubmission } from '@/platform/workflow/sharing/composables/useComfyHubPublishSubmission'
import { useComfyHubPublishWizard } from '@/platform/workflow/sharing/composables/useComfyHubPublishWizard'
import { useComfyHubProfileGate } from '@/platform/workflow/sharing/composables/useComfyHubProfileGate'
import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { OnCloseKey } from '@/types/widgetTypes'

const { onClose } = defineProps<{
  onClose: () => void
}>()

const { fetchProfile } = useComfyHubProfileGate()
const { submitToComfyHub } = useComfyHubPublishSubmission()
const {
  currentStep,
  formData,
  isFirstStep,
  isLastStep,
  goToStep,
  goNext,
  goBack,
  openProfileCreationStep,
  closeProfileCreationStep
} = useComfyHubPublishWizard()
const isPublishing = ref(false)

function handlePublishGateComplete() {
  closeProfileCreationStep()
  void fetchProfile({ force: true })
}

function handlePublishGateClose() {
  closeProfileCreationStep()
}

function handleRequireProfile() {
  openProfileCreationStep()
}

async function handlePublish(): Promise<void> {
  if (isPublishing.value) {
    return
  }

  isPublishing.value = true
  try {
    await submitToComfyHub(formData.value)
    onClose()
  } finally {
    isPublishing.value = false
  }
}

function updateFormData(patch: Partial<ComfyHubPublishFormData>) {
  formData.value = { ...formData.value, ...patch }
}

onMounted(() => {
  // Prefetch profile data in the background so finish-step profile context is ready.
  void fetchProfile()
})

onBeforeUnmount(() => {
  for (const image of formData.value.exampleImages) {
    URL.revokeObjectURL(image.url)
  }
})

provide(OnCloseKey, onClose)
</script>

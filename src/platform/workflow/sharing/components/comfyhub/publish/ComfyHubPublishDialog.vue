<template>
  <BaseModalLayout
    :content-title="$t('comfyHubPublish.title')"
    content-padding="none"
    left-panel-width="16.5rem"
    size="md"
  >
    <template #leftPanelHeaderTitle>
      <h2 class="flex-1 select-none text-base font-semibold">
        {{ $t('comfyHubPublish.title') }}
      </h2>
    </template>

    <template #leftPanel>
      <ComfyHubPublishNav
        v-if="publishPanelState === 'publishWizard'"
        :current-step
        @step-click="goToStep"
      />
      <div v-else class="flex flex-col gap-2 px-3 py-4">
        <div
          class="flex h-10 items-center rounded-lg bg-secondary-background-selected px-4 py-3 text-sm text-base-foreground"
        >
          {{ $t('comfyHubProfile.profileCreationNav') }}
        </div>
      </div>
    </template>

    <template #header />
    <template #content>
      <ComfyHubPublishWizardPanel
        :publish-panel-state="publishPanelState"
        :current-step="currentStep"
        :form-data="formData"
        :is-first-step="isFirstStep"
        :is-last-step="isLastStep"
        :on-update-form-data="updateFormData"
        :on-go-next="goNext"
        :on-go-back="goBack"
        :on-cancel="onClose"
        :on-gate-complete="handlePublishGateComplete"
        :on-gate-close="onClose"
        :on-publish="onClose"
      />
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref } from 'vue'

import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import ComfyHubPublishNav from '@/platform/workflow/sharing/components/comfyhub/publish/ComfyHubPublishNav.vue'
import ComfyHubPublishWizardPanel from '@/platform/workflow/sharing/components/comfyhub/publish/ComfyHubPublishWizardPanel.vue'
import { useComfyHubPublishWizard } from '@/platform/workflow/sharing/composables/useComfyHubPublishWizard'
import { useComfyHubProfileGate } from '@/platform/workflow/sharing/composables/useComfyHubProfileGate'
import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { OnCloseKey } from '@/types/widgetTypes'

const { onClose } = defineProps<{
  onClose: () => void
}>()

type PublishPanelState =
  | 'uninitialized'
  | 'checkingAccess'
  | 'gateFlow'
  | 'publishWizard'

const { checkProfile } = useComfyHubProfileGate()
const { flags } = useFeatureFlags()
const publishPanelState = ref<PublishPanelState>('uninitialized')
const {
  currentStep,
  formData,
  isFirstStep,
  isLastStep,
  goToStep,
  goNext,
  goBack
} = useComfyHubPublishWizard()

function handlePublishGateComplete() {
  publishPanelState.value = 'publishWizard'
}

function updateFormData(patch: Partial<ComfyHubPublishFormData>) {
  formData.value = { ...formData.value, ...patch }
}

async function resolvePublishPanelState() {
  if (!flags.comfyHubProfileGateEnabled) {
    publishPanelState.value = 'publishWizard'
    return
  }

  publishPanelState.value = 'checkingAccess'
  try {
    const hasPublishAccess = await checkProfile()
    publishPanelState.value = hasPublishAccess ? 'publishWizard' : 'gateFlow'
  } catch (error) {
    console.error('Failed to resolve publish dialog access:', error)
    onClose()
  }
}

onMounted(() => {
  void resolvePublishPanelState()
})

onBeforeUnmount(() => {
  for (const image of formData.value.exampleImages) {
    URL.revokeObjectURL(image.url)
  }
})

provide(OnCloseKey, onClose)
</script>

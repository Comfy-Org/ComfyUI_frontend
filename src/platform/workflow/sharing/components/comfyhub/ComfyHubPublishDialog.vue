<template>
  <BaseModalLayout content-title="" size="md" left-panel-width="16rem">
    <template #leftPanelHeaderTitle>
      <h2 class="text-base font-semibold text-base-foreground">
        {{ $t('comfyHubPublish.title') }}
      </h2>
    </template>

    <template #leftPanel>
      <ComfyHubPublishNav :current-step="currentStep" @step-click="goToStep" />
    </template>

    <template #header />

    <template #content>
      <div class="flex min-h-0 flex-1 flex-col">
        <div class="flex flex-col min-h-0 flex-1 overflow-y-auto">
          <ComfyHubDescribeStep
            v-if="currentStep === 'describe'"
            :name="formData.name"
            :description="formData.description"
            :tags="formData.tags"
            :thumbnail-type="formData.thumbnailType"
            @update:name="formData.name = $event"
            @update:description="formData.description = $event"
            @update:tags="formData.tags = $event"
            @update:thumbnail-type="formData.thumbnailType = $event"
            @update:thumbnail-file="formData.thumbnailFile = $event"
          />
          <ComfyHubExamplesStep
            v-else-if="currentStep === 'examples'"
            :example-images="formData.exampleImages"
            :selected-example-ids="formData.selectedExampleIds"
            @update:example-images="formData.exampleImages = $event"
            @update:selected-example-ids="formData.selectedExampleIds = $event"
          />
          <ComfyHubFinishStep v-else-if="currentStep === 'finish'" />
        </div>
        <ComfyHubPublishFooter
          :is-first-step="isFirstStep"
          :is-last-step="isLastStep"
          @back="goBack"
          @next="goNext"
          @publish="handlePublish"
        />
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { provide } from 'vue'

import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import ComfyHubDescribeStep from '@/platform/workflow/sharing/components/comfyhub/ComfyHubDescribeStep.vue'
import ComfyHubExamplesStep from '@/platform/workflow/sharing/components/comfyhub/ComfyHubExamplesStep.vue'
import ComfyHubFinishStep from '@/platform/workflow/sharing/components/comfyhub/ComfyHubFinishStep.vue'
import ComfyHubPublishFooter from '@/platform/workflow/sharing/components/comfyhub/ComfyHubPublishFooter.vue'
import ComfyHubPublishNav from '@/platform/workflow/sharing/components/comfyhub/ComfyHubPublishNav.vue'
import { useComfyHubPublishWizard } from '@/platform/workflow/sharing/composables/useComfyHubPublishWizard'
import { OnCloseKey } from '@/types/widgetTypes'

const { onClose } = defineProps<{
  onClose: () => void
}>()

provide(OnCloseKey, onClose)

const {
  currentStep,
  formData,
  isFirstStep,
  isLastStep,
  goToStep,
  goNext,
  goBack
} = useComfyHubPublishWizard()

function handlePublish() {
  // TODO: Implement publish to ComfyHub API
  onClose()
}
</script>

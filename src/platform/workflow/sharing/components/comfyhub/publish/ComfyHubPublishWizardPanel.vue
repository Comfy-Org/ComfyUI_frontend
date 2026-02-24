<template>
  <div class="flex min-h-0 flex-1 flex-col md:flex-row">
    <aside
      class="shrink-0 border-b border-border-default md:w-64 md:border-b-0 md:border-r"
    >
      <ComfyHubPublishNav :current-step="currentStep" @step-click="goToStep" />
    </aside>

    <section class="flex min-h-0 flex-1 flex-col px-4 py-3 md:px-6 md:py-4">
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <ComfyHubDescribeStep
          v-if="currentStep === 'describe'"
          :name="formData.name"
          :description="formData.description"
          :thumbnail-type="formData.thumbnailType"
          @update:name="formData.name = $event"
          @update:description="formData.description = $event"
          @update:thumbnail-type="formData.thumbnailType = $event"
          @update:thumbnail-file="formData.thumbnailFile = $event"
          @update:comparison-before-file="
            formData.comparisonBeforeFile = $event
          "
          @update:comparison-after-file="formData.comparisonAfterFile = $event"
        />
        <ComfyHubExamplesStep
          v-else-if="currentStep === 'examples'"
          :example-images="formData.exampleImages"
          :selected-example-ids="formData.selectedExampleIds"
          @update:example-images="formData.exampleImages = $event"
          @update:selected-example-ids="formData.selectedExampleIds = $event"
        />
        <ComfyHubFinishStep
          v-else-if="currentStep === 'finish'"
          :tags="formData.tags"
          @update:tags="formData.tags = $event"
        />
      </div>
      <ComfyHubPublishFooter
        :is-first-step="isFirstStep"
        :is-last-step="isLastStep"
        @back="goBack"
        @next="goNext"
        @publish="handlePublish"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'

import ComfyHubDescribeStep from './ComfyHubDescribeStep.vue'
import ComfyHubExamplesStep from './ComfyHubExamplesStep.vue'
import ComfyHubFinishStep from './ComfyHubFinishStep.vue'
import ComfyHubPublishFooter from './ComfyHubPublishFooter.vue'
import ComfyHubPublishNav from './ComfyHubPublishNav.vue'
import { useComfyHubPublishWizard } from '@/platform/workflow/sharing/composables/useComfyHubPublishWizard'

const { onPublish } = defineProps<{
  onPublish: () => void
}>()

const {
  currentStep,
  formData,
  isFirstStep,
  isLastStep,
  goToStep,
  goNext,
  goBack
} = useComfyHubPublishWizard()

onBeforeUnmount(() => {
  for (const image of formData.value.exampleImages) {
    URL.revokeObjectURL(image.url)
  }
})

function handlePublish() {
  // TODO: Implement publish to ComfyHub API
  onPublish()
}
</script>

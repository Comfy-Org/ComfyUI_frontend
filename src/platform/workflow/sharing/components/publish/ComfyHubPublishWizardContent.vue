<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <ComfyHubCreateProfileForm
      v-if="currentStep === 'profileCreation'"
      data-testid="publish-gate-flow"
      :on-profile-created="() => onGateComplete()"
      :on-close="onGateClose"
      :show-close-button="false"
    />
    <div v-else class="flex min-h-0 flex-1 flex-col px-6 pt-4 pb-2">
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <ComfyHubDescribeStep
          v-if="currentStep === 'describe'"
          :name="formData.name"
          :description="formData.description"
          :workflow-type="formData.workflowType"
          :tags="formData.tags"
          @update:name="onUpdateFormData({ name: $event })"
          @update:description="onUpdateFormData({ description: $event })"
          @update:workflow-type="onUpdateFormData({ workflowType: $event })"
          @update:tags="onUpdateFormData({ tags: $event })"
        />
        <div
          v-else-if="currentStep === 'examples'"
          class="flex min-h-0 flex-1 flex-col gap-6 px-6 py-4"
        >
          <ComfyHubThumbnailStep
            :thumbnail-type="formData.thumbnailType"
            @update:thumbnail-type="onUpdateFormData({ thumbnailType: $event })"
            @update:thumbnail-file="onUpdateFormData({ thumbnailFile: $event })"
            @update:comparison-before-file="
              onUpdateFormData({ comparisonBeforeFile: $event })
            "
            @update:comparison-after-file="
              onUpdateFormData({ comparisonAfterFile: $event })
            "
          />
          <ComfyHubExamplesStep
            :example-images="formData.exampleImages"
            :selected-example-ids="formData.selectedExampleIds"
            @update:example-images="onUpdateFormData({ exampleImages: $event })"
            @update:selected-example-ids="
              onUpdateFormData({ selectedExampleIds: $event })
            "
          />
        </div>
        <ComfyHubProfilePromptPanel
          v-else-if="currentStep === 'finish'"
          @request-profile="onRequireProfile"
        />
      </div>
      <ComfyHubPublishFooter
        :is-first-step
        :is-last-step
        :is-publish-disabled
        @back="onGoBack"
        @next="onGoNext"
        @publish="handlePublish"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useComfyHubProfileGate } from '@/platform/workflow/sharing/composables/useComfyHubProfileGate'
import ComfyHubCreateProfileForm from '@/platform/workflow/sharing/components/profile/ComfyHubCreateProfileForm.vue'
import type { ComfyHubPublishStep } from '@/platform/workflow/sharing/composables/useComfyHubPublishWizard'
import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'
import ComfyHubDescribeStep from './ComfyHubDescribeStep.vue'
import ComfyHubExamplesStep from './ComfyHubExamplesStep.vue'
import ComfyHubProfilePromptPanel from './ComfyHubProfilePromptPanel.vue'
import ComfyHubThumbnailStep from './ComfyHubThumbnailStep.vue'
import ComfyHubPublishFooter from './ComfyHubPublishFooter.vue'

const {
  currentStep,
  formData,
  isFirstStep,
  isLastStep,
  onGoNext,
  onGoBack,
  onUpdateFormData,
  onPublish,
  onRequireProfile,
  onGateComplete = () => {},
  onGateClose = () => {}
} = defineProps<{
  currentStep: ComfyHubPublishStep
  formData: ComfyHubPublishFormData
  isFirstStep: boolean
  isLastStep: boolean
  onGoNext: () => void
  onGoBack: () => void
  onUpdateFormData: (patch: Partial<ComfyHubPublishFormData>) => void
  onPublish: () => void
  onRequireProfile: () => void
  onGateComplete?: () => void
  onGateClose?: () => void
}>()

const { toastErrorHandler } = useErrorHandling()
const { flags } = useFeatureFlags()
const { checkProfile, hasProfile } = useComfyHubProfileGate()
const isResolvingPublishAccess = ref(false)
const isPublishDisabled = computed(
  () => flags.comfyHubProfileGateEnabled && hasProfile.value !== true
)

async function handlePublish() {
  if (isResolvingPublishAccess.value) {
    return
  }

  if (!flags.comfyHubProfileGateEnabled) {
    onPublish()
    return
  }

  isResolvingPublishAccess.value = true
  try {
    let profileExists: boolean
    try {
      profileExists = await checkProfile()
    } catch (error) {
      toastErrorHandler(error)
      return
    }

    if (profileExists) {
      onPublish()
      return
    }

    onRequireProfile()
  } finally {
    isResolvingPublishAccess.value = false
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <ComfyHubCreateProfileForm
      v-if="currentStep === 'profileCreation'"
      data-testid="publish-gate-flow"
      :on-profile-created="() => onGateComplete()"
      :on-close="onGateClose"
      :show-close-button="false"
    />
    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <ComfyHubDescribeStep
          v-if="currentStep === 'describe'"
          :name="formData.name"
          :description="formData.description"
          :tags="formData.tags"
          @update:name="onUpdateFormData({ name: $event })"
          @update:description="onUpdateFormData({ description: $event })"
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
            @update:example-images="onUpdateFormData({ exampleImages: $event })"
          />
        </div>
        <div
          v-else-if="currentStep === 'finish' && isProfileLoading"
          class="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4"
        >
          <Skeleton class="h-4 w-1/4" />
          <Skeleton class="h-20 w-full rounded-2xl" />
        </div>
        <ComfyHubFinishStep
          v-else-if="currentStep === 'finish' && hasProfile && profile"
          ref="finishStepRef"
          v-model:acknowledged="assetsAcknowledged"
          :profile
        />
        <ComfyHubProfilePromptPanel
          v-else-if="currentStep === 'finish'"
          @request-profile="onRequireProfile"
        />
      </div>
      <ComfyHubPublishFooter
        :is-first-step
        :is-last-step
        :is-publish-disabled
        :is-publishing="isPublishInFlight"
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
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import ComfyHubDescribeStep from './ComfyHubDescribeStep.vue'
import ComfyHubExamplesStep from './ComfyHubExamplesStep.vue'
import ComfyHubFinishStep from './ComfyHubFinishStep.vue'
import ComfyHubProfilePromptPanel from './ComfyHubProfilePromptPanel.vue'
import ComfyHubThumbnailStep from './ComfyHubThumbnailStep.vue'
import ComfyHubPublishFooter from './ComfyHubPublishFooter.vue'

const {
  currentStep,
  formData,
  isFirstStep,
  isLastStep,
  isPublishing = false,
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
  isPublishing?: boolean
  onGoNext: () => void
  onGoBack: () => void
  onUpdateFormData: (patch: Partial<ComfyHubPublishFormData>) => void
  onPublish: () => Promise<void>
  onRequireProfile: () => void
  onGateComplete?: () => void
  onGateClose?: () => void
}>()

const { toastErrorHandler } = useErrorHandling()
const { flags } = useFeatureFlags()
const { checkProfile, hasProfile, isFetchingProfile, profile } =
  useComfyHubProfileGate()
const isProfileLoading = computed(
  () => hasProfile.value === null || isFetchingProfile.value
)
const finishStepRef = ref<InstanceType<typeof ComfyHubFinishStep> | null>(null)
const assetsAcknowledged = ref(false)
const isResolvingPublishAccess = ref(false)
const isPublishInFlight = computed(
  () => isPublishing || isResolvingPublishAccess.value
)
const isPublishDisabled = computed(
  () =>
    isPublishInFlight.value ||
    (flags.comfyHubProfileGateEnabled && hasProfile.value !== true) ||
    (finishStepRef.value !== null && !finishStepRef.value.isReady)
)

async function handlePublish() {
  if (isResolvingPublishAccess.value || isPublishing) {
    return
  }

  isResolvingPublishAccess.value = true
  try {
    if (!flags.comfyHubProfileGateEnabled) {
      await onPublish()
      return
    }

    let profileExists: boolean
    try {
      profileExists = await checkProfile()
    } catch (error) {
      toastErrorHandler(error)
      return
    }

    if (profileExists) {
      await onPublish()
      return
    }

    onRequireProfile()
  } catch (error) {
    toastErrorHandler(error)
  } finally {
    isResolvingPublishAccess.value = false
  }
}
</script>

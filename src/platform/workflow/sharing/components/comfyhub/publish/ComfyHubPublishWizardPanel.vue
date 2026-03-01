<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      v-if="publishPanelState === 'checkingAccess'"
      data-testid="publish-access-loading"
      class="flex min-h-0 flex-1 items-center justify-center px-6 py-8 text-sm text-muted-foreground"
    >
      {{ $t('comfyHubProfile.checkingAccess') }}
    </div>
    <ComfyHubProfileGateDialog
      v-else-if="publishPanelState === 'gateFlow'"
      data-testid="publish-gate-flow"
      :on-complete="onGateComplete"
      :on-close="onGateClose"
      initial-step="create"
      :show-close-button="false"
    />
    <div v-else class="flex min-h-0 flex-1 flex-col px-6 pb-2 pt-4">
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
        <ComfyHubExamplesStep
          v-else-if="currentStep === 'examples'"
          :example-images="formData.exampleImages"
          :selected-example-ids="formData.selectedExampleIds"
          @update:example-images="onUpdateFormData({ exampleImages: $event })"
          @update:selected-example-ids="
            onUpdateFormData({ selectedExampleIds: $event })
          "
        />
        <ComfyHubFinishStep
          v-else-if="currentStep === 'finish'"
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
      </div>
      <ComfyHubPublishFooter
        v-if="publishPanelState === 'publishWizard'"
        :is-first-step="isFirstStep"
        :is-last-step="isLastStep"
        @back="onGoBack"
        @next="onGoNext"
        @publish="handlePublish"
        @cancel="onCancel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import ComfyHubProfileGateDialog from '@/platform/workflow/sharing/components/comfyhub/profile/ComfyHubProfileGateDialog.vue'
import type { ComfyHubPublishStep } from '@/platform/workflow/sharing/composables/useComfyHubPublishWizard'
import type {
  ComfyHubPublishFormData,
  PublishPanelState
} from '@/platform/workflow/sharing/types/comfyHubTypes'
import ComfyHubDescribeStep from './ComfyHubDescribeStep.vue'
import ComfyHubExamplesStep from './ComfyHubExamplesStep.vue'
import ComfyHubFinishStep from './ComfyHubFinishStep.vue'
import ComfyHubPublishFooter from './ComfyHubPublishFooter.vue'

const {
  currentStep,
  formData,
  isFirstStep,
  isLastStep,
  onGoNext,
  onGoBack,
  onUpdateFormData,
  onCancel,
  onPublish,
  onGateComplete = () => {},
  onGateClose = () => {},
  publishPanelState = 'publishWizard'
} = defineProps<{
  currentStep: ComfyHubPublishStep
  formData: ComfyHubPublishFormData
  isFirstStep: boolean
  isLastStep: boolean
  onGoNext: () => void
  onGoBack: () => void
  onUpdateFormData: (patch: Partial<ComfyHubPublishFormData>) => void
  onCancel: () => void
  onPublish: () => void
  onGateComplete?: () => void
  onGateClose?: () => void
  publishPanelState?: PublishPanelState
}>()

function handlePublish() {
  // TODO: Implement publish to ComfyHub API
  onPublish()
}
</script>

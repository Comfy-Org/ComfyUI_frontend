<template>
  <BaseModalLayout
    :content-title="t('templatePublishing.dialogTitle')"
    size="md"
  >
    <template #leftPanelHeaderTitle>
      <i class="icon-[lucide--upload]" />
      <h2 class="text-neutral text-base">
        {{ t('templatePublishing.dialogTitle') }}
      </h2>
    </template>

    <template #leftPanel>
      <TemplatePublishingStepperNav
        :current-step="currentStep"
        :step-definitions="stepDefinitions"
        @update:current-step="goToStep"
      />
    </template>

    <template #header>
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground text-sm">
          {{
            t('templatePublishing.stepProgress', {
              current: currentStep,
              total: totalSteps
            })
          }}
        </span>
      </div>
    </template>

    <template #header-right-area>
      <div class="flex gap-2">
        <Button
          :disabled="isFirstStep"
          variant="secondary"
          size="lg"
          @click="prevStep"
        >
          <i class="icon-[lucide--arrow-left]" />
          {{ t('templatePublishing.previous') }}
        </Button>
        <Button variant="secondary" size="lg" @click="saveDraft">
          <i class="icon-[lucide--save]" />
          {{ t('templatePublishing.saveDraft') }}
        </Button>
        <Button
          :disabled="currentStep >= totalSteps - 1"
          size="lg"
          @click="nextStep"
        >
          {{ t('templatePublishing.next') }}
          <i class="icon-[lucide--arrow-right]" />
        </Button>
      </div>
    </template>

    <template #content>
      <component :is="activeStepComponent" />
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'

import { OnCloseKey } from '@/types/widgetTypes'

import Button from '@/components/ui/button/Button.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import { useTemplatePublishingStepper } from '@/composables/useTemplatePublishingStepper'

import TemplatePublishingStepperNav from './TemplatePublishingStepperNav.vue'
import StepTemplatePublishingCategoryAndTagging from './steps/StepTemplatePublishingCategoryAndTagging.vue'
import StepTemplatePublishingComplete from './steps/StepTemplatePublishingComplete.vue'
import StepTemplatePublishingDescription from './steps/StepTemplatePublishingDescription.vue'
import StepTemplatePublishingLanding from './steps/StepTemplatePublishingLanding.vue'
import StepTemplatePublishingMetadata from './steps/StepTemplatePublishingMetadata.vue'
import StepTemplatePublishingPreview from './steps/StepTemplatePublishingPreview.vue'
import StepTemplatePublishingPreviewGeneration from './steps/StepTemplatePublishingPreviewGeneration.vue'
import StepTemplatePublishingSubmissionForReview from './steps/StepTemplatePublishingSubmissionForReview.vue'
import { PublishingStepperKey } from './types'

const { onClose, initialPage } = defineProps<{
  onClose: () => void
  initialPage?: string
}>()

const { t } = useI18n()

provide(OnCloseKey, onClose)

const STEP_PAGE_MAP: Record<string, number> = {
  publishingLanding: 1,
  metadata: 2,
  description: 3,
  previewGeneration: 4,
  categoryAndTagging: 5,
  preview: 6,
  submissionForReview: 7,
  complete: 8
}

const initialStep = initialPage ? (STEP_PAGE_MAP[initialPage] ?? 1) : 1

const {
  currentStep,
  totalSteps,
  template,
  stepDefinitions,
  isFirstStep,
  isLastStep,
  canProceed,
  nextStep,
  prevStep,
  goToStep,
  saveDraft,
  setStepValid
} = useTemplatePublishingStepper({ initialStep })

const STEP_COMPONENTS: Component[] = [
  StepTemplatePublishingLanding,
  StepTemplatePublishingMetadata,
  StepTemplatePublishingDescription,
  StepTemplatePublishingPreviewGeneration,
  StepTemplatePublishingCategoryAndTagging,
  StepTemplatePublishingPreview,
  StepTemplatePublishingSubmissionForReview,
  StepTemplatePublishingComplete
]

const activeStepComponent = computed(
  () => STEP_COMPONENTS[currentStep.value - 1]
)

provide(PublishingStepperKey, {
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  canProceed,
  template,
  nextStep,
  prevStep,
  goToStep,
  saveDraft,
  setStepValid
})
</script>

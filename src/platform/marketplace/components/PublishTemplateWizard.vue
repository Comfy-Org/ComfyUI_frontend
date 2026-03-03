<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 overflow-y-auto scrollbar-custom">
      <component :is="stepComponent" ref="activeStep" />
    </div>

    <PublishTemplateFooter
      :current-step="wizard.currentStep.value"
      :is-submitting="wizard.isSubmitting.value"
      @cancel="emit('cancel')"
      @back="wizard.goToPreviousStep"
      @next="handleNext"
      @submit="handleSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { usePublishTemplateWizard } from '../composables/usePublishTemplateWizard'

import PublishTemplateFooter from './PublishTemplateFooter.vue'
import PublishTemplateStepMedia from './PublishTemplateStepMedia.vue'
import PublishTemplateStepMetadata from './PublishTemplateStepMetadata.vue'
import PublishTemplateStepReview from './PublishTemplateStepReview.vue'

const wizard = usePublishTemplateWizard()

const emit = defineEmits<{
  cancel: []
  submitted: []
}>()

const STEP_COMPONENTS = [
  PublishTemplateStepMetadata,
  PublishTemplateStepMedia,
  PublishTemplateStepReview
] as const

const stepComponent = computed(
  () => STEP_COMPONENTS[wizard.currentStep.value - 1]
)

const activeStep = ref<{ validate?: () => boolean } | null>(null)

function handleNext() {
  const isValid = activeStep.value?.validate?.() ?? true
  if (isValid) wizard.goToNextStep()
}

async function handleSubmit() {
  await wizard.submit()
  emit('submitted')
}
</script>

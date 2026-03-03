import type { InjectionKey } from 'vue'
import { inject, provide, ref } from 'vue'

import { createTemplate, submitTemplate } from '../services/templateApi'
import type { CreateTemplateRequest } from '../types/marketplace'

function createPublishTemplateWizard() {
  const currentStep = ref(1)
  const wizardData = ref<Partial<CreateTemplateRequest>>({
    version: '1.0.0'
  })
  // Uploaded file URLs managed by the media step
  const uploadedFiles = ref<string[]>([])
  const isSubmitting = ref(false)
  const submitError = ref<string | null>(null)

  function goToStep(step: number) {
    if (step >= currentStep.value) return
    currentStep.value = step
  }

  function goToNextStep() {
    if (currentStep.value < 3) {
      currentStep.value = currentStep.value + 1
    }
  }

  function goToPreviousStep() {
    if (currentStep.value > 1) {
      currentStep.value = currentStep.value - 1
    }
  }

  function resetWizard() {
    currentStep.value = 1
    wizardData.value = { version: '1.0.0' }
    uploadedFiles.value = []
    isSubmitting.value = false
    submitError.value = null
  }

  async function submit() {
    isSubmitting.value = true
    submitError.value = null

    try {
      const body: CreateTemplateRequest = {
        template: wizardData.value.template!,
        shortDescription: wizardData.value.shortDescription!,
        difficulty: wizardData.value.difficulty!,
        categories: wizardData.value.categories,
        version: wizardData.value.version ?? '1.0.0',
        changelog: wizardData.value.changelog
      }

      const { id } = await createTemplate(body)
      await submitTemplate(id)
    } catch (err) {
      submitError.value =
        err instanceof Error ? err.message : 'Submission failed'
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    currentStep,
    wizardData,
    uploadedFiles,
    isSubmitting,
    submitError,

    goToStep,
    goToNextStep,
    goToPreviousStep,
    resetWizard,
    submit
  }
}

export type PublishTemplateWizardContext = ReturnType<
  typeof createPublishTemplateWizard
>

const PublishTemplateWizardKey: InjectionKey<PublishTemplateWizardContext> =
  Symbol('PublishTemplateWizard')

export function usePublishTemplateWizard(): PublishTemplateWizardContext {
  const existing = inject(PublishTemplateWizardKey, null)
  if (existing) return existing

  const wizard = createPublishTemplateWizard()
  provide(PublishTemplateWizardKey, wizard)
  return wizard
}

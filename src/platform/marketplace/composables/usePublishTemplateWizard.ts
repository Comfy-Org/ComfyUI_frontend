import type { InjectionKey } from 'vue'
import { inject, provide, ref } from 'vue'

import { createTemplate, submitTemplate } from '../services/templateApi'
import type { CreateTemplateRequest } from '../types/marketplace'

function createPublishTemplateWizard() {
  const currentStep = ref(1)
  const wizardData = ref<Partial<CreateTemplateRequest>>({
    version: '1.0.0',
    gallery: []
  })
  const isSubmitting = ref(false)

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
    wizardData.value = { version: '1.0.0', gallery: [] }
    isSubmitting.value = false
  }

  async function submit() {
    isSubmitting.value = true

    try {
      const body: CreateTemplateRequest = {
        template: wizardData.value.template!,
        shortDescription: wizardData.value.shortDescription!,
        difficulty: wizardData.value.difficulty!,
        categories: wizardData.value.categories,
        gallery: wizardData.value.gallery,
        version: wizardData.value.version ?? '1.0.0',
        changelog: wizardData.value.changelog
      }

      const { id } = await createTemplate(body)
      await submitTemplate(id)
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    currentStep,
    wizardData,
    isSubmitting,

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

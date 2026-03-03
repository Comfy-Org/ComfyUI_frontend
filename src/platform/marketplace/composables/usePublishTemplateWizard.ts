import type { InjectionKey } from 'vue'
import { inject, provide, ref } from 'vue'

import {
  createDraftTemplate,
  createTemplate,
  submitTemplate,
  updateTemplate
} from '../services/templateApi'
import { isUpdateTemplateRequest } from '../types/marketplace'
import type {
  CreateTemplateRequest,
  UpdateTemplateRequest
} from '../types/marketplace'

function createPublishTemplateWizard() {
  const currentStep = ref(1)
  const wizardData = ref<
    Partial<CreateTemplateRequest> | UpdateTemplateRequest
  >({
    version: '1.0.0',
    gallery: []
  })
  const isSubmitting = ref(false)
  const isSaving = ref(false)

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
    isSaving.value = false
  }

  async function saveDraft() {
    isSaving.value = true
    try {
      if (isUpdateTemplateRequest(wizardData.value)) {
        await updateTemplate(wizardData.value)
      } else {
        await createDraftTemplate(wizardData.value)
      }
    } finally {
      isSaving.value = false
    }
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

      if (isUpdateTemplateRequest(wizardData.value)) {
        await updateTemplate(wizardData.value)
        await submitTemplate(wizardData.value.id)
      } else {
        const { id } = await createTemplate(body)
        await submitTemplate(id)
      }
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    currentStep,
    wizardData,
    isSubmitting,
    isSaving,

    goToStep,
    goToNextStep,
    goToPreviousStep,
    resetWizard,
    saveDraft,
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

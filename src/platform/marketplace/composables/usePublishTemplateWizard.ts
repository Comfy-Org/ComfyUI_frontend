import type { InjectionKey } from 'vue'
import { inject, provide, ref } from 'vue'

import {
  createTemplateDraft,
  submitTemplate,
  updateTemplate
} from '../services/templateApi'
import type { MarketplaceTemplate } from '../types/marketplace'
import {
  createTemplateDraftRequestSchema,
  submitTemplateRequestSchema,
  updateTemplateRequestSchema
} from '../schemas/templateSchema'

function createPublishTemplateWizard() {
  const currentStep = ref(1)
  function createInitialData(): Partial<MarketplaceTemplate> {
    return {
      gallery: [],
      categories: [],
      tags: [],
      mediaType: 'image',
      mediaSubtype: 'photo'
    }
  }

  const wizardData = ref<Partial<MarketplaceTemplate>>(createInitialData())
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
    wizardData.value = createInitialData()
    isSubmitting.value = false
    isSaving.value = false
  }

  async function saveDraft() {
    isSaving.value = true
    try {
      if (wizardData.value.id) {
        const request = updateTemplateRequestSchema.parse(wizardData.value)
        await updateTemplate(request)
      } else {
        const request = createTemplateDraftRequestSchema.parse(wizardData.value)
        await createTemplateDraft(request)
      }
    } finally {
      isSaving.value = false
    }
  }

  async function revertToDraft() {
    if (!wizardData.value.id) return
    isSaving.value = true
    try {
      const request = updateTemplateRequestSchema.parse({
        ...wizardData.value,
        status: 'draft'
      })
      await updateTemplate(request)
      wizardData.value.status = 'draft'
    } finally {
      isSaving.value = false
    }
  }

  async function submit() {
    isSubmitting.value = true
    try {
      const request = submitTemplateRequestSchema.parse(wizardData.value)
      await submitTemplate(request)
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
    revertToDraft,
    saveDraft,
    submit
  }
}

type PublishTemplateWizardContext = ReturnType<
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

import type { InjectionKey, Ref } from 'vue'

import type { MarketplaceTemplate } from '@/types/templateMarketplace'

/**
 * Definition of a single step in the template publishing wizard.
 */
export interface PublishingStepDefinition {
  /** 1-indexed step number */
  number: number
  /** i18n key for the step's display title */
  titleKey: string
  /** i18n key for the step's short description */
  descriptionKey: string
}

/**
 * Context shared between the publishing dialog and its step panels
 * via provide/inject.
 */
export interface PublishingStepperContext {
  currentStep: Readonly<Ref<number>>
  totalSteps: number
  isFirstStep: Readonly<Ref<boolean>>
  isLastStep: Readonly<Ref<boolean>>
  canProceed: Readonly<Ref<boolean>>
  template: Ref<Partial<MarketplaceTemplate>>
  nextStep: () => void
  prevStep: () => void
  goToStep: (step: number) => void
  saveDraft: () => void
  setStepValid: (step: number, valid: boolean) => void
}

/**
 * Injection key for the publishing stepper context, allowing step panel
 * components to access shared navigation and draft state.
 */
export const PublishingStepperKey: InjectionKey<PublishingStepperContext> =
  Symbol('PublishingStepperContext')

export const PUBLISHING_STEP_DEFINITIONS: PublishingStepDefinition[] = [
  {
    number: 1,
    titleKey: 'templatePublishing.steps.landing.title',
    descriptionKey: 'templatePublishing.steps.landing.description'
  },
  {
    number: 2,
    titleKey: 'templatePublishing.steps.metadata.title',
    descriptionKey: 'templatePublishing.steps.metadata.description'
  },
  {
    number: 3,
    titleKey: 'templatePublishing.steps.description.title',
    descriptionKey: 'templatePublishing.steps.description.description'
  },
  {
    number: 4,
    titleKey: 'templatePublishing.steps.previewGeneration.title',
    descriptionKey: 'templatePublishing.steps.previewGeneration.description'
  },
  {
    number: 5,
    titleKey: 'templatePublishing.steps.categoryAndTagging.title',
    descriptionKey: 'templatePublishing.steps.categoryAndTagging.description'
  },
  {
    number: 6,
    titleKey: 'templatePublishing.steps.preview.title',
    descriptionKey: 'templatePublishing.steps.preview.description'
  },
  {
    number: 7,
    titleKey: 'templatePublishing.steps.submissionForReview.title',
    descriptionKey: 'templatePublishing.steps.submissionForReview.description'
  },
  {
    number: 8,
    titleKey: 'templatePublishing.steps.complete.title',
    descriptionKey: 'templatePublishing.steps.complete.description'
  }
]

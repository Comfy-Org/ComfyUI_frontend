import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { MarketplaceTemplate } from '@/types/templateMarketplace'

import type { PublishingStepperContext } from '../types'
import { PublishingStepperKey } from '../types'
import StepTemplatePublishingSubmissionForReview from './StepTemplatePublishingSubmissionForReview.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      templatePublishing: {
        submit: 'Submit for Review',
        steps: {
          submissionForReview: {
            title: 'Submit',
            description: 'Submit your template for review.'
          }
        }
      }
    }
  }
})

function createContext(
  overrides: Partial<PublishingStepperContext> = {}
): PublishingStepperContext {
  const template = ref<Partial<MarketplaceTemplate>>({})
  const currentStep = ref(7)
  return {
    currentStep,
    totalSteps: 8,
    isFirstStep: computed(() => currentStep.value === 1),
    isLastStep: computed(() => currentStep.value === 8),
    canProceed: computed(() => false),
    template,
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    goToStep: vi.fn(),
    saveDraft: vi.fn(),
    setStepValid: vi.fn(),
    ...overrides
  }
}

function mountStep(ctx?: PublishingStepperContext) {
  const context = ctx ?? createContext()
  return {
    wrapper: mount(StepTemplatePublishingSubmissionForReview, {
      global: {
        plugins: [i18n],
        provide: { [PublishingStepperKey as symbol]: context }
      }
    }),
    ctx: context
  }
}

describe('StepTemplatePublishingSubmissionForReview', () => {
  it('renders the description text', () => {
    const { wrapper } = mountStep()
    expect(wrapper.text()).toContain('Submit your template for review.')
  })

  it('renders a submit button', () => {
    const { wrapper } = mountStep()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('Submit for Review')
  })

  it('calls nextStep when the submit button is clicked', async () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)
    const button = wrapper.find('button')
    await button.trigger('click')
    expect(ctx.nextStep).toHaveBeenCalledOnce()
  })
})

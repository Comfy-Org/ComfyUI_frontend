import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

vi.mock(
  '@/platform/workflow/templates/composables/useTemplatePublishStorage',
  () => ({
    loadTemplateUnderway: vi.fn(() => null),
    saveTemplateUnderway: vi.fn()
  })
)

import TemplatePublishingDialog from './TemplatePublishingDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      templatePublishing: {
        dialogTitle: 'Template Publishing',
        next: 'Next',
        previous: 'Previous',
        saveDraft: 'Save Draft',
        stepProgress: 'Step {current} of {total}',
        steps: {
          landing: {
            title: 'Getting Started',
            description: 'Overview of the publishing process'
          },
          metadata: {
            title: 'Metadata',
            description: 'Title, description, and author info'
          },
          description: {
            title: 'Description',
            description: 'Write a detailed description of your template'
          },
          previewGeneration: {
            title: 'Preview',
            description: 'Generate preview images and videos'
          },
          categoryAndTagging: {
            title: 'Categories & Tags',
            description: 'Categorize and tag your template'
          },
          preview: {
            title: 'Preview',
            description: 'Review your template before submitting'
          },
          submissionForReview: {
            title: 'Submit',
            description: 'Submit your template for review'
          },
          complete: {
            title: 'Complete',
            description: 'Your template has been submitted'
          }
        }
      }
    }
  }
})

function mountDialog(props?: { initialPage?: string }) {
  return mount(TemplatePublishingDialog, {
    props: {
      onClose: vi.fn(),
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        BaseModalLayout: {
          template: `
            <div data-testid="modal">
              <div data-testid="left-panel"><slot name="leftPanel" /></div>
              <div data-testid="header"><slot name="header" /></div>
              <div data-testid="header-right"><slot name="header-right-area" /></div>
              <div data-testid="content"><slot name="content" /></div>
            </div>
          `
        },
        TemplatePublishingStepperNav: {
          template: '<div data-testid="stepper-nav" />',
          props: ['currentStep', 'stepDefinitions']
        },
        StepTemplatePublishingLanding: {
          template: '<div data-testid="step-landing" />'
        },
        StepTemplatePublishingMetadata: {
          template: '<div data-testid="step-metadata" />'
        },
        StepTemplatePublishingDescription: {
          template: '<div data-testid="step-description" />'
        },
        StepTemplatePublishingPreviewGeneration: {
          template: '<div data-testid="step-preview-generation" />'
        },
        StepTemplatePublishingCategoryAndTagging: {
          template: '<div data-testid="step-category" />'
        },
        StepTemplatePublishingPreview: {
          template: '<div data-testid="step-preview" />'
        },
        StepTemplatePublishingSubmissionForReview: {
          template: '<div data-testid="step-submission" />'
        },
        StepTemplatePublishingComplete: {
          template: '<div data-testid="step-complete" />'
        }
      }
    }
  })
}

describe('TemplatePublishingDialog', () => {
  it('renders the dialog with the first step by default', () => {
    const wrapper = mountDialog()
    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="step-landing"]').exists()).toBe(true)
  })

  it('renders the stepper nav in the left panel', () => {
    const wrapper = mountDialog()
    const leftPanel = wrapper.find('[data-testid="left-panel"]')
    expect(leftPanel.find('[data-testid="stepper-nav"]').exists()).toBe(true)
  })

  it('maps initialPage to the correct starting step', () => {
    const wrapper = mountDialog({ initialPage: 'metadata' })
    expect(wrapper.find('[data-testid="step-metadata"]').exists()).toBe(true)
  })

  it('defaults to step 1 for unknown initialPage', () => {
    const wrapper = mountDialog({ initialPage: 'nonexistent' })
    expect(wrapper.find('[data-testid="step-landing"]').exists()).toBe(true)
  })

  it('shows Previous button when not on first step', () => {
    const wrapper = mountDialog({ initialPage: 'metadata' })
    const headerRight = wrapper.find('[data-testid="header-right"]')

    const buttons = headerRight.findAll('button')
    const buttonTexts = buttons.map((b) => b.text())
    expect(buttonTexts.some((text) => text.includes('Previous'))).toBe(true)
  })

  it('disables Previous button on first step', () => {
    const wrapper = mountDialog()
    const headerRight = wrapper.find('[data-testid="header-right"]')

    const prevButton = headerRight
      .findAll('button')
      .find((b) => b.text().includes('Previous'))
    expect(prevButton?.attributes('disabled')).toBeDefined()
  })

  it('disables Next button on last step', () => {
    const wrapper = mountDialog({
      initialPage: 'complete'
    })
    const headerRight = wrapper.find('[data-testid="header-right"]')

    const nextButton = headerRight
      .findAll('button')
      .find((b) => b.text().includes('Next'))
    expect(nextButton?.attributes('disabled')).toBeDefined()
  })

  it('disables Next button on submit step', () => {
    const wrapper = mountDialog({
      initialPage: 'submissionForReview'
    })
    const headerRight = wrapper.find('[data-testid="header-right"]')

    const nextButton = headerRight
      .findAll('button')
      .find((b) => b.text().includes('Next'))
    expect(nextButton?.attributes('disabled')).toBeDefined()
  })
})

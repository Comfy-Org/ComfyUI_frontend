import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { MarketplaceTemplate } from '@/types/templateMarketplace'

import type { PublishingStepperContext } from '../types'
import { PublishingStepperKey } from '../types'
import StepTemplatePublishingDescription from './StepTemplatePublishingDescription.vue'

vi.mock('@/utils/markdownRendererUtil', () => ({
  renderMarkdownToHtml: vi.fn((md: string) => `<p>${md}</p>`)
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      templatePublishing: {
        steps: {
          description: {
            title: 'Description',
            description: 'Write a detailed description of your template',
            editorLabel: 'Description (Markdown)',
            previewLabel: 'Description (Render preview)'
          }
        }
      }
    }
  }
})

function createContext(
  templateData: Partial<MarketplaceTemplate> = {}
): PublishingStepperContext {
  const template = ref<Partial<MarketplaceTemplate>>(templateData)
  const currentStep = ref(3)
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
    setStepValid: vi.fn()
  }
}

function mountStep(ctx?: PublishingStepperContext) {
  const context = ctx ?? createContext()
  return {
    wrapper: mount(StepTemplatePublishingDescription, {
      global: {
        plugins: [i18n],
        provide: { [PublishingStepperKey as symbol]: context }
      }
    }),
    ctx: context
  }
}

describe('StepTemplatePublishingDescription', () => {
  it('renders editor and preview labels', () => {
    const { wrapper } = mountStep()
    expect(wrapper.text()).toContain('Description (Markdown)')
    expect(wrapper.text()).toContain('Description (Render preview)')
  })

  it('renders a textarea for markdown editing', () => {
    const { wrapper } = mountStep()
    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
  })

  it('binds textarea to template.description', () => {
    const ctx = createContext({ description: 'Hello **world**' })
    const { wrapper } = mountStep(ctx)
    const textarea = wrapper.find('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      'Hello **world**'
    )
  })

  it('updates template.description when textarea changes', async () => {
    const ctx = createContext({ description: '' })
    const { wrapper } = mountStep(ctx)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('New content')
    expect(ctx.template.value.description).toBe('New content')
  })

  it('renders markdown preview from template.description', () => {
    const ctx = createContext({ description: 'Some markdown' })
    const { wrapper } = mountStep(ctx)
    const preview = wrapper.find('[class*="prose"]')
    expect(preview.html()).toContain('<p>Some markdown</p>')
  })

  it('renders empty preview when description is undefined', () => {
    const ctx = createContext({})
    const { wrapper } = mountStep(ctx)
    const preview = wrapper.find('[class*="prose"]')
    expect(preview.html()).toContain('<p></p>')
  })
})

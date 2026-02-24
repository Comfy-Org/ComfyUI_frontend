import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { MarketplaceTemplate } from '@/types/templateMarketplace'

import type { PublishingStepperContext } from '../types'
import { PublishingStepperKey } from '../types'
import StepTemplatePublishingCategoryAndTagging from './StepTemplatePublishingCategoryAndTagging.vue'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    watchDebounced: vi.fn((source: unknown, cb: unknown, opts: unknown) => {
      const typedActual = actual as {
        watchDebounced: (...args: unknown[]) => unknown
      }
      return typedActual.watchDebounced(source, cb, {
        ...(opts as object),
        debounce: 0
      })
    })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      templatePublishing: {
        steps: {
          metadata: {
            categoryLabel: 'Categories',
            tagsLabel: 'Tags',
            tagsPlaceholder: 'Type to search tags…',
            category: {
              imageGeneration: 'Image Generation',
              videoGeneration: 'Video Generation',
              audio: 'Audio',
              text: 'Text',
              threeD: '3D',
              upscaling: 'Upscaling',
              inpainting: 'Inpainting',
              controlNet: 'ControlNet',
              styleTransfer: 'Style Transfer',
              other: 'Other'
            }
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
  const currentStep = ref(5)
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
    wrapper: mount(StepTemplatePublishingCategoryAndTagging, {
      global: {
        plugins: [i18n],
        provide: { [PublishingStepperKey as symbol]: context }
      }
    }),
    ctx: context
  }
}

describe('StepTemplatePublishingCategoryAndTagging', () => {
  it('renders category and tag labels', () => {
    const { wrapper } = mountStep()
    expect(wrapper.text()).toContain('Categories')
    expect(wrapper.text()).toContain('Tags')
  })

  it('renders all category checkboxes', () => {
    const { wrapper } = mountStep()
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(10)
    expect(wrapper.text()).toContain('Image Generation')
    expect(wrapper.text()).toContain('ControlNet')
  })

  it('toggles category when checkbox is clicked', async () => {
    const ctx = createContext({ categories: [] })
    const { wrapper } = mountStep(ctx)

    const checkbox = wrapper.find('#tpl-category-audio')
    await checkbox.setValue(true)

    expect(ctx.template.value.categories).toContain('audio')

    await checkbox.setValue(false)
    expect(ctx.template.value.categories).not.toContain('audio')
  })

  it('preserves existing categories when toggling', async () => {
    const ctx = createContext({ categories: ['text', '3d'] })
    const { wrapper } = mountStep(ctx)

    const audioCheckbox = wrapper.find('#tpl-category-audio')
    await audioCheckbox.setValue(true)

    expect(ctx.template.value.categories).toContain('text')
    expect(ctx.template.value.categories).toContain('3d')
    expect(ctx.template.value.categories).toContain('audio')
  })

  it('adds a tag when pressing enter in the tags input', async () => {
    const ctx = createContext({ tags: [] })
    const { wrapper } = mountStep(ctx)

    const tagInput = wrapper.find('input[type="text"]')
    await tagInput.setValue('my-tag')
    await tagInput.trigger('keydown.enter')

    expect(ctx.template.value.tags).toContain('my-tag')
  })

  it('does not add duplicate tags', async () => {
    const ctx = createContext({ tags: ['existing'] })
    const { wrapper } = mountStep(ctx)

    const tagInput = wrapper.find('input[type="text"]')
    await tagInput.setValue('existing')
    await tagInput.trigger('keydown.enter')

    expect(ctx.template.value.tags).toEqual(['existing'])
  })

  it('removes a tag when the remove button is clicked', async () => {
    const ctx = createContext({ tags: ['alpha', 'beta'] })
    const { wrapper } = mountStep(ctx)

    const removeButtons = wrapper.findAll('button[aria-label^="Remove tag"]')
    await removeButtons[0].trigger('click')

    expect(ctx.template.value.tags).toEqual(['beta'])
  })

  it('shows filtered suggestions when typing in tags input', async () => {
    const ctx = createContext({ tags: [] })
    const { wrapper } = mountStep(ctx)

    const tagInput = wrapper.find('input[type="text"]')
    await tagInput.setValue('flux')
    await tagInput.trigger('focus')

    const suggestions = wrapper.findAll('li')
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0].text()).toBe('flux')
  })

  it('adds a suggestion tag when clicking it', async () => {
    const ctx = createContext({ tags: [] })
    const { wrapper } = mountStep(ctx)

    const tagInput = wrapper.find('input[type="text"]')
    await tagInput.setValue('flux')
    await tagInput.trigger('focus')

    const suggestion = wrapper.find('li')
    await suggestion.trigger('mousedown')

    expect(ctx.template.value.tags).toContain('flux')
  })
})

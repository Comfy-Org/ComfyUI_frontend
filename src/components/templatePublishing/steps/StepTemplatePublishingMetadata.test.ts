import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { computed, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { MarketplaceTemplate } from '@/types/templateMarketplace'
import { NodeSourceType } from '@/types/nodeSource'

import type { PublishingStepperContext } from '../types'
import { PublishingStepperKey } from '../types'
import StepTemplatePublishingMetadata from './StepTemplatePublishingMetadata.vue'

const mockNodes = vi.hoisted(() => [
  { type: 'KSampler', isSubgraphNode: () => false },
  { type: 'MyCustomNode', isSubgraphNode: () => false },
  { type: 'AnotherCustom', isSubgraphNode: () => false },
  { type: 'MyCustomNode', isSubgraphNode: () => false }
])

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

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      nodes: mockNodes
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  mapAllNodes: vi.fn(
    (
      graph: { nodes: Array<{ type: string }> },
      mapFn: (node: { type: string }) => string | undefined
    ) => graph.nodes.map(mapFn).filter(Boolean)
  )
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    nodeDefsByName: {
      KSampler: { name: 'KSampler', nodeSource: { type: NodeSourceType.Core } },
      MyCustomNode: {
        name: 'MyCustomNode',
        nodeSource: { type: NodeSourceType.CustomNodes }
      },
      AnotherCustom: {
        name: 'AnotherCustom',
        nodeSource: { type: NodeSourceType.CustomNodes }
      },
      ExtraCustomPack: {
        name: 'ExtraCustomPack',
        nodeSource: { type: NodeSourceType.CustomNodes }
      }
    }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      templatePublishing: {
        steps: {
          metadata: {
            title: 'Metadata',
            description: 'Title, description, and author info',
            titleLabel: 'Title',
            difficultyLabel: 'Difficulty',
            licenseLabel: 'License',
            requiredNodesLabel: 'Custom Nodes',
            requiredNodesDetected: 'Detected from workflow',
            requiredNodesManualPlaceholder: 'Add custom node name…',
            requiredNodesManualLabel: 'Additional custom nodes',
            difficulty: {
              beginner: 'Beginner',
              intermediate: 'Intermediate',
              advanced: 'Advanced'
            },
            license: {
              mit: 'MIT',
              ccBy: 'CC BY',
              ccBySa: 'CC BY-SA',
              ccByNc: 'CC BY-NC',
              apache: 'Apache',
              custom: 'Custom'
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
  const currentStep = ref(2)
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
    wrapper: mount(StepTemplatePublishingMetadata, {
      global: {
        plugins: [i18n],
        provide: { [PublishingStepperKey as symbol]: context },
        stubs: {
          FormItem: {
            template:
              '<div :data-testid="`form-item-${id}`"><input :value="formValue" @input="$emit(\'update:formValue\', $event.target.value)" /></div>',
            props: ['item', 'id', 'formValue', 'labelClass'],
            emits: ['update:formValue']
          }
        }
      }
    }),
    ctx: context
  }
}

describe('StepTemplatePublishingMetadata', () => {
  it('renders all form fields', () => {
    const { wrapper } = mountStep()

    expect(wrapper.find('#tpl-title').exists()).toBe(true)
    expect(wrapper.text()).toContain('Difficulty')
    expect(wrapper.find('[data-testid="form-item-tpl-license"]').exists()).toBe(
      true
    )
  })

  it('selects difficulty when radio button is clicked', async () => {
    const ctx = createContext({})
    const { wrapper } = mountStep(ctx)

    const intermediateRadio = wrapper.find('#tpl-difficulty-intermediate')
    await intermediateRadio.setValue(true)

    expect(ctx.template.value.difficulty).toBe('intermediate')
  })

  it('displays detected custom nodes from the workflow', async () => {
    const { wrapper } = mountStep()
    await nextTick()

    expect(wrapper.text()).toContain('AnotherCustom')
    expect(wrapper.text()).toContain('MyCustomNode')
    expect(wrapper.text()).not.toContain('KSampler')
  })

  it('populates requiredNodes on mount when empty', () => {
    const ctx = createContext({ requiredNodes: [] })
    mountStep(ctx)

    expect(ctx.template.value.requiredNodes).toContain('AnotherCustom')
    expect(ctx.template.value.requiredNodes).toContain('MyCustomNode')
    expect(ctx.template.value.requiredNodes).not.toContain('KSampler')
  })

  it('does not overwrite existing requiredNodes on mount', () => {
    const ctx = createContext({ requiredNodes: ['PreExisting'] })
    mountStep(ctx)

    expect(ctx.template.value.requiredNodes).toEqual(['PreExisting'])
  })

  it('adds a manual custom node via the input', async () => {
    const ctx = createContext({ requiredNodes: [] })
    const { wrapper } = mountStep(ctx)

    const input = wrapper.find('.relative input[type="text"]')
    await input.setValue('ManualNode')
    await input.trigger('keydown.enter')

    expect(ctx.template.value.requiredNodes).toContain('ManualNode')
  })

  it('removes a manual custom node when its remove button is clicked', async () => {
    const ctx = createContext({
      requiredNodes: ['AnotherCustom', 'MyCustomNode', 'ManualNode']
    })
    const { wrapper } = mountStep(ctx)

    const removeButtons = wrapper.findAll(
      'button[aria-label="Remove ManualNode"]'
    )
    await removeButtons[0].trigger('click')

    expect(ctx.template.value.requiredNodes).not.toContain('ManualNode')
  })

  it('shows filtered custom node suggestions when typing', async () => {
    const ctx = createContext({ requiredNodes: [] })
    const { wrapper } = mountStep(ctx)

    const input = wrapper.find('.relative input[type="text"]')
    await input.trigger('focus')
    await input.setValue('Extra')

    const suggestions = wrapper.findAll('.relative ul li')
    expect(suggestions.length).toBe(1)
    expect(suggestions[0].text()).toBe('ExtraCustomPack')
  })

  it('excludes already-added nodes from suggestions', async () => {
    const ctx = createContext({ requiredNodes: ['ExtraCustomPack'] })
    const { wrapper } = mountStep(ctx)

    const input = wrapper.find('.relative input[type="text"]')
    await input.trigger('focus')
    await input.setValue('Extra')

    const suggestions = wrapper.findAll('.relative ul li')
    expect(suggestions.length).toBe(0)
  })

  it('adds a node from the suggestion dropdown', async () => {
    const ctx = createContext({ requiredNodes: [] })
    const { wrapper } = mountStep(ctx)

    const input = wrapper.find('.relative input[type="text"]')
    await input.trigger('focus')
    await input.setValue('Extra')

    const suggestion = wrapper.find('.relative ul li')
    await suggestion.trigger('mousedown')

    expect(ctx.template.value.requiredNodes).toContain('ExtraCustomPack')
  })
})

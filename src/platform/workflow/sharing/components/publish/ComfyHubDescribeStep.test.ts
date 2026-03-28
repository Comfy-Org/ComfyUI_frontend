import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { COMFY_HUB_TAG_OPTIONS } from '@/platform/workflow/sharing/constants/comfyHubTags'

const mockFetchTagLabels = vi.hoisted(() => vi.fn())

vi.mock('@/platform/workflow/sharing/services/comfyHubService', () => ({
  useComfyHubService: () => ({
    fetchTagLabels: mockFetchTagLabels
  })
}))

import ComfyHubDescribeStep from './ComfyHubDescribeStep.vue'

function mountStep(
  props: Partial<InstanceType<typeof ComfyHubDescribeStep>['$props']> = {}
) {
  return mount(ComfyHubDescribeStep, {
    props: {
      name: 'Workflow Name',
      description: 'Workflow description',
      tags: [],
      ...props
    },
    global: {
      mocks: {
        $t: (key: string) => key
      },
      stubs: {
        Input: {
          template:
            '<input data-testid="name-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          props: ['modelValue']
        },
        Textarea: {
          template:
            '<textarea data-testid="description-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          props: ['modelValue']
        },
        TagsInput: {
          template:
            '<div data-testid="tags-input" :data-disabled="disabled ? \'true\' : \'false\'"><slot :is-empty="!modelValue || modelValue.length === 0" /></div>',
          props: {
            modelValue: {
              type: Array,
              default: () => []
            },
            disabled: Boolean
          }
        },
        TagsInputItem: {
          template:
            '<button data-testid="tag-item" :data-value="value" type="button"><slot /></button>',
          props: ['value']
        },
        TagsInputItemText: {
          template: '<span data-testid="tag-item-text" />'
        },
        TagsInputItemDelete: {
          template: '<button data-testid="tag-item-delete" type="button" />'
        },
        TagsInputInput: {
          template: '<input data-testid="tags-input-input" />'
        },
        Button: {
          template:
            '<button data-testid="toggle-suggestions" type="button"><slot /></button>'
        }
      }
    }
  })
}

describe('ComfyHubDescribeStep', () => {
  it('emits name and description updates', async () => {
    mockFetchTagLabels.mockRejectedValue(new Error('offline'))
    const wrapper = mountStep()
    await flushPromises()

    await wrapper.find('[data-testid="name-input"]').setValue('New workflow')
    await wrapper
      .find('[data-testid="description-input"]')
      .setValue('New description')

    expect(wrapper.emitted('update:name')).toEqual([['New workflow']])
    expect(wrapper.emitted('update:description')).toEqual([['New description']])
  })

  it('uses fetched tags from API', async () => {
    const apiTags = ['Alpha', 'Beta', 'Gamma']
    mockFetchTagLabels.mockResolvedValue(apiTags)
    const wrapper = mountStep()
    await flushPromises()

    const suggestionValues = wrapper
      .findAll(
        '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
      )
      .map((button) => button.attributes('data-value'))

    expect(suggestionValues).toEqual(apiTags)
  })

  it('falls back to hardcoded tags when API fails', async () => {
    mockFetchTagLabels.mockRejectedValue(new Error('network error'))
    const wrapper = mountStep()
    await flushPromises()

    const suggestionValues = wrapper
      .findAll(
        '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
      )
      .map((button) => button.attributes('data-value'))

    expect(suggestionValues).toHaveLength(10)
    expect(suggestionValues[0]).toBe(COMFY_HUB_TAG_OPTIONS[0])
  })

  it('adds a suggested tag when clicked', async () => {
    const apiTags = ['Alpha', 'Beta']
    mockFetchTagLabels.mockResolvedValue(apiTags)
    const wrapper = mountStep()
    await flushPromises()

    const suggestionButtons = wrapper.findAll(
      '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
    )

    await suggestionButtons[0].trigger('click')

    const tagUpdates = wrapper.emitted('update:tags')
    expect(tagUpdates?.at(-1)).toEqual([['Alpha']])
  })

  it('hides already-selected tags from suggestions', async () => {
    const apiTags = ['Alpha', 'Beta', 'Gamma']
    mockFetchTagLabels.mockResolvedValue(apiTags)
    const wrapper = mountStep({ tags: ['Alpha'] })
    await flushPromises()

    const suggestionValues = wrapper
      .findAll(
        '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
      )
      .map((button) => button.attributes('data-value'))

    expect(suggestionValues).not.toContain('Alpha')
    expect(suggestionValues).toEqual(['Beta', 'Gamma'])
  })

  it('toggles between default and full suggestion lists', async () => {
    mockFetchTagLabels.mockRejectedValue(new Error('offline'))
    const wrapper = mountStep()
    await flushPromises()

    const defaultSuggestions = wrapper.findAll(
      '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
    )
    expect(defaultSuggestions).toHaveLength(10)
    expect(wrapper.text()).toContain('comfyHubPublish.showMoreTags')

    await wrapper.find('[data-testid="toggle-suggestions"]').trigger('click')
    await wrapper.vm.$nextTick()

    const allSuggestions = wrapper.findAll(
      '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
    )
    expect(allSuggestions).toHaveLength(COMFY_HUB_TAG_OPTIONS.length)
    expect(wrapper.text()).toContain('comfyHubPublish.showLessTags')
  })
})

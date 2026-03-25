import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { COMFY_HUB_TAG_OPTIONS } from '@/platform/workflow/sharing/constants/comfyHubTags'

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
    const wrapper = mountStep()

    await wrapper.find('[data-testid="name-input"]').setValue('New workflow')
    await wrapper
      .find('[data-testid="description-input"]')
      .setValue('New description')

    expect(wrapper.emitted('update:name')).toEqual([['New workflow']])
    expect(wrapper.emitted('update:description')).toEqual([['New description']])
  })

  it('adds a suggested tag when clicked', async () => {
    const wrapper = mountStep()
    const suggestionButtons = wrapper.findAll(
      '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
    )

    expect(suggestionButtons.length).toBeGreaterThan(0)

    const firstSuggestion = suggestionButtons[0].attributes('data-value')
    await suggestionButtons[0].trigger('click')

    const tagUpdates = wrapper.emitted('update:tags')
    expect(tagUpdates?.at(-1)).toEqual([[firstSuggestion]])
  })

  it('hides already-selected tags from suggestions', () => {
    const selectedTag = COMFY_HUB_TAG_OPTIONS[0]
    const wrapper = mountStep({ tags: [selectedTag] })
    const suggestionValues = wrapper
      .findAll(
        '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
      )
      .map((button) => button.attributes('data-value'))

    expect(suggestionValues).not.toContain(selectedTag)
  })

  it('toggles between default and full suggestion lists', async () => {
    const wrapper = mountStep()

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

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import TagsInput from './TagsInput.vue'
import TagsInputInput from './TagsInputInput.vue'
import TagsInputItem from './TagsInputItem.vue'
import TagsInputItemDelete from './TagsInputItemDelete.vue'
import TagsInputItemText from './TagsInputItemText.vue'

describe('TagsInput', () => {
  const mountTagsInput = (props = {}, slots = {}) => {
    return mount(TagsInput, {
      props: {
        modelValue: [],
        ...props
      },
      slots
    })
  }

  it('renders with default styling classes', () => {
    const wrapper = mountTagsInput()

    expect(wrapper.classes()).toContain('flex')
    expect(wrapper.classes()).toContain('rounded-md')
    expect(wrapper.classes()).toContain('border')
  })

  it('applies custom class prop', () => {
    const wrapper = mountTagsInput({ class: 'custom-class' })

    expect(wrapper.classes()).toContain('custom-class')
  })

  it('renders slot content', () => {
    const wrapper = mountTagsInput({}, { default: '<span>Slot Content</span>' })

    expect(wrapper.text()).toContain('Slot Content')
  })

  it('applies design system border and background tokens', () => {
    const wrapper = mountTagsInput()

    expect(wrapper.classes()).toContain('border-secondary-background-hover')
    expect(wrapper.classes()).toContain('bg-base-background')
  })

  it('has focus ring styling', () => {
    const wrapper = mountTagsInput()

    expect(wrapper.classes()).toContain('focus-within:ring-1')
    expect(wrapper.classes()).toContain('focus-within:ring-primary-background')
  })
})

describe('TagsInput with child components', () => {
  function mountFullTagsInput(tags: string[] = ['tag1', 'tag2']) {
    return mount(TagsInput, {
      props: {
        modelValue: tags
      },
      slots: {
        default: () => [
          ...tags.map((tag) =>
            h(TagsInputItem, { key: tag, value: tag }, () => [
              h(TagsInputItemText),
              h(TagsInputItemDelete)
            ])
          ),
          h(TagsInputInput, { placeholder: 'Add tag...' })
        ]
      }
    })
  }

  it('renders tags as child items', () => {
    const wrapper = mountFullTagsInput(['Vue', 'TypeScript'])

    const items = wrapper.findAllComponents(TagsInputItem)
    expect(items).toHaveLength(2)
  })

  it('renders input for adding new tags', () => {
    const wrapper = mountFullTagsInput()

    const input = wrapper.findComponent(TagsInputInput)
    expect(input.exists()).toBe(true)
  })

  it('renders delete buttons for each tag', () => {
    const wrapper = mountFullTagsInput(['tag1', 'tag2'])

    const deleteButtons = wrapper.findAllComponents(TagsInputItemDelete)
    expect(deleteButtons).toHaveLength(2)
  })

  it('renders tag text for each tag', () => {
    const wrapper = mountFullTagsInput(['tag1', 'tag2'])

    const textElements = wrapper.findAllComponents(TagsInputItemText)
    expect(textElements).toHaveLength(2)
  })

  it('renders X icons in delete buttons', () => {
    const wrapper = mountFullTagsInput(['tag1'])

    const icon = wrapper.find('i.icon-\\[lucide--x\\]')
    expect(icon.exists()).toBe(true)
  })

  it('updates model value when adding a tag', async () => {
    let currentTags = ['existing']

    const wrapper = mount(TagsInput, {
      props: {
        modelValue: currentTags,
        'onUpdate:modelValue': (payload: unknown[]) => {
          currentTags = payload as string[]
        }
      },
      slots: {
        default: () => h(TagsInputInput, { placeholder: 'Add tag...' })
      }
    })

    const input = wrapper.find('input')
    await input.setValue('newTag')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(currentTags).toContain('newTag')
  })
})

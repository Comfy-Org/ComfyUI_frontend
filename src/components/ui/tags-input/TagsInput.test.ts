import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import TagsInput from './TagsInput.vue'
import TagsInputInput from './TagsInputInput.vue'
import TagsInputItem from './TagsInputItem.vue'
import TagsInputItemDelete from './TagsInputItemDelete.vue'
import TagsInputItemText from './TagsInputItemText.vue'

describe('TagsInput', () => {
  function mountTagsInput(props = {}, slots = {}) {
    return mount(TagsInput, {
      props: {
        modelValue: [],
        ...props
      },
      slots
    })
  }

  it('renders slot content', () => {
    const wrapper = mountTagsInput({}, { default: '<span>Slot Content</span>' })

    expect(wrapper.text()).toContain('Slot Content')
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

  it('updates model value when adding a tag', async () => {
    let currentTags = ['existing']

    const wrapper = mount<typeof TagsInput<string>>(TagsInput, {
      props: {
        modelValue: currentTags,
        'onUpdate:modelValue': (payload) => {
          currentTags = payload
        }
      },
      slots: {
        default: () => h(TagsInputInput, { placeholder: 'Add tag...' })
      }
    })

    await wrapper.trigger('click')
    await nextTick()

    const input = wrapper.find('input')
    await input.setValue('newTag')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(currentTags).toContain('newTag')
  })
})

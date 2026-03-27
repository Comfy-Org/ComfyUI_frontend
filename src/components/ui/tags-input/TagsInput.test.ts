import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import TagsInput from './TagsInput.vue'
import TagsInputInput from './TagsInputInput.vue'
import TagsInputItem from './TagsInputItem.vue'
import TagsInputItemDelete from './TagsInputItemDelete.vue'
import TagsInputItemText from './TagsInputItemText.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { removeTag: 'Remove tag' } } }
})

describe('TagsInput', () => {
  function renderTagsInput(props = {}, slots = {}) {
    const user = userEvent.setup()

    const result = render(TagsInput, {
      props: {
        modelValue: [],
        ...props
      },
      slots
    })

    return { ...result, user }
  }

  it('renders slot content', () => {
    renderTagsInput({}, { default: '<span>Slot Content</span>' })

    expect(screen.getByText('Slot Content')).toBeInTheDocument()
  })
})

describe('TagsInput with child components', () => {
  function renderFullTagsInput(
    tags: string[] = ['tag1', 'tag2'],
    extraProps: Record<string, unknown> = {}
  ) {
    const user = userEvent.setup()

    const result = render(TagsInput, {
      global: { plugins: [i18n] },
      props: {
        modelValue: tags,
        ...extraProps
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

    return { ...result, user }
  }

  it('renders tags structure and content', () => {
    const tags = ['tag1', 'tag2']
    renderFullTagsInput(tags)

    expect(screen.getByText('tag1')).toBeInTheDocument()
    expect(screen.getByText('tag2')).toBeInTheDocument()

    const deleteButtons = tags.map((tag) =>
      screen.getByRole('button', { name: tag })
    )
    expect(deleteButtons).toHaveLength(tags.length)
  })

  it('updates model value when adding a tag', async () => {
    const onUpdate = vi.fn()

    const user = userEvent.setup()
    const { container } = render(TagsInput, {
      props: {
        modelValue: ['existing'],
        'onUpdate:modelValue': onUpdate
      },
      slots: {
        default: () => h(TagsInputInput, { placeholder: 'Add tag...' })
      }
    })

    // Click the container to enter edit mode and show the input
    // eslint-disable-next-line testing-library/no-node-access -- TagsInput root element needs click to enter edit mode; no role/label available
    await user.click(container.firstElementChild!)
    await nextTick()

    const input = screen.getByPlaceholderText('Add tag...')
    await user.type(input, 'newTag{Enter}')
    await nextTick()

    expect(onUpdate).toHaveBeenCalledWith(['existing', 'newTag'])
  })

  it('does not enter edit mode when disabled', async () => {
    const user = userEvent.setup()
    const { container } = render(TagsInput, {
      props: {
        modelValue: ['tag1'],
        disabled: true
      },
      slots: {
        default: () => h(TagsInputInput, { placeholder: 'Add tag...' })
      }
    })

    expect(screen.queryByPlaceholderText('Add tag...')).not.toBeInTheDocument()

    // eslint-disable-next-line testing-library/no-node-access -- TagsInput root element needs click to test disabled behavior; no role/label available
    await user.click(container.firstElementChild!)
    await nextTick()

    expect(screen.queryByPlaceholderText('Add tag...')).not.toBeInTheDocument()
  })

  it('exits edit mode when clicking outside', async () => {
    const outsideElement = document.createElement('div')
    document.body.appendChild(outsideElement)

    const user = userEvent.setup()
    const { container } = render(TagsInput, {
      props: {
        modelValue: ['tag1']
      },
      slots: {
        default: () => h(TagsInputInput, { placeholder: 'Add tag...' })
      }
    })

    // eslint-disable-next-line testing-library/no-node-access -- TagsInput root element needs click; no role/label
    await user.click(container.firstElementChild!)
    await nextTick()
    expect(screen.getByPlaceholderText('Add tag...')).toBeInTheDocument()

    outsideElement.dispatchEvent(new PointerEvent('click', { bubbles: true }))
    await nextTick()

    expect(screen.queryByPlaceholderText('Add tag...')).not.toBeInTheDocument()

    outsideElement.remove()
  })

  it('shows placeholder when modelValue is empty', async () => {
    render(TagsInput, {
      props: {
        modelValue: []
      },
      slots: {
        default: ({ isEmpty }: { isEmpty: boolean }) =>
          h(TagsInputInput, { placeholder: 'Add tag...', isEmpty })
      }
    })

    await nextTick()

    const input = screen.getByPlaceholderText('Add tag...')
    expect(input).toBeInTheDocument()
  })
})

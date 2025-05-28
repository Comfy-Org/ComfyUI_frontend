import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ChatHistoryWidget from '@/components/graph/widgets/ChatHistoryWidget.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { edit: 'Edit' },
      chatHistory: {
        cancelEdit: 'Cancel edit',
        cancelEditTooltip: 'Cancel edit'
      }
    }
  }
})

vi.mock('@/components/graph/widgets/chatHistory/CopyButton.vue', () => ({
  default: {
    name: 'CopyButton',
    template: '<div class="mock-copy-button"></div>',
    props: ['text']
  }
}))

vi.mock('@/components/graph/widgets/chatHistory/ResponseBlurb.vue', () => ({
  default: {
    name: 'ResponseBlurb',
    template: '<div class="mock-response-blurb"><slot /></div>',
    props: ['text']
  }
}))

describe('ChatHistoryWidget.vue', () => {
  const mockHistory = JSON.stringify([
    { prompt: 'Test prompt', response: 'Test response', response_id: '123' }
  ])

  const mountWidget = (props: { history: string; widget?: any }) => {
    return mount(ChatHistoryWidget, {
      props,
      global: {
        plugins: [i18n],
        stubs: {
          Button: {
            template: '<button><slot /></button>',
            props: ['icon', 'aria-label']
          },
          ScrollPanel: { template: '<div><slot /></div>' }
        }
      }
    })
  }

  it('renders chat history correctly', () => {
    const wrapper = mountWidget({ history: mockHistory })
    expect(wrapper.text()).toContain('Test prompt')
    expect(wrapper.text()).toContain('Test response')
  })

  it('handles empty history', () => {
    const wrapper = mountWidget({ history: '[]' })
    expect(wrapper.find('.mb-4').exists()).toBe(false)
  })

  it('edits previous prompts', () => {
    const mockWidget = {
      node: { widgets: [{ name: 'prompt', value: '' }] }
    }

    const wrapper = mountWidget({ history: mockHistory, widget: mockWidget })
    const vm = wrapper.vm as any
    vm.handleEdit(0)

    expect(mockWidget.node.widgets[0].value).toContain('Test prompt')
    expect(mockWidget.node.widgets[0].value).toContain('starting_point_id')
  })

  it('cancels editing correctly', () => {
    const mockWidget = {
      node: { widgets: [{ name: 'prompt', value: 'Original value' }] }
    }

    const wrapper = mountWidget({ history: mockHistory, widget: mockWidget })
    const vm = wrapper.vm as any

    vm.handleEdit(0)
    vm.handleCancelEdit()

    expect(mockWidget.node.widgets[0].value).toBe('Original value')
  })
})

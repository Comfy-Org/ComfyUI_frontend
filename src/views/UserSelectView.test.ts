import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import UserSelectView from '@/views/UserSelectView.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

const mockUsers = [
  { userId: '1', username: 'alice' },
  { userId: '2', username: 'bob' },
  { userId: '3', username: 'admin' }
]

vi.mock('@/stores/userStore', () => ({
  useUserStore: () => ({
    users: mockUsers,
    initialized: true,
    initialize: vi.fn(),
    createUser: vi.fn(),
    login: vi.fn()
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      userSelect: {
        newUser: 'New user',
        enterUsername: 'Enter username',
        existingUser: 'Existing user',
        selectUser: 'Select a user',
        next: 'Next'
      }
    }
  }
})

const AutoCompletePlusStub = defineComponent({
  name: 'AutoCompletePlus',
  props: {
    modelValue: { type: [String, Object], default: null },
    suggestions: { type: Array, default: () => [] },
    optionLabel: { type: String, default: '' },
    inputId: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    completeOnFocus: { type: Boolean, default: false },
    keepOpenOnEmptyInput: { type: Boolean, default: false },
    blurOnOptionSelect: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'complete', 'clear'],
  setup(props, { emit, expose }) {
    const show = vi.fn()
    expose({ show })

    const getDisplayValue = () => {
      const value = props.modelValue
      if (typeof value === 'string') return value
      if (value && typeof value === 'object' && props.optionLabel) {
        const record = value as Record<string, unknown>
        const label = record[props.optionLabel]
        return typeof label === 'string' ? label : ''
      }
      return ''
    }

    const onFocus = (event: FocusEvent) => {
      if (props.completeOnFocus) {
        emit('complete', { originalEvent: event, query: getDisplayValue() })
      }
    }

    const onInput = (event: Event) => {
      const query = (event.target as HTMLInputElement).value
      emit('update:modelValue', query)
      if (query === '') {
        emit('clear')
        if (props.keepOpenOnEmptyInput) {
          emit('complete', { originalEvent: event, query: '' })
        }
        return
      }
      emit('complete', { originalEvent: event, query })
    }

    return () =>
      h('div', [
        h('input', {
          id: props.inputId,
          disabled: props.disabled,
          placeholder: props.placeholder,
          value: getDisplayValue(),
          onFocus,
          onInput
        })
      ])
  }
})

describe('UserSelectView', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const createWrapper = () => {
    return mount(UserSelectView, {
      attachTo: document.body,
      global: {
        plugins: [i18n],
        stubs: {
          BaseViewTemplate: { template: '<div><slot /></div>' },
          Divider: { template: '<div />' },
          Button: { template: '<button />' },
          InputText: { template: '<input />' },
          Message: { template: '<div><slot /></div>' },
          AutoCompletePlus: AutoCompletePlusStub
        }
      }
    })
  }

  it('shows all users when query is empty', async () => {
    const wrapper = createWrapper()
    await nextTick()

    const input = wrapper.find('#existing-user-select')
    await input.trigger('focus')
    await nextTick()

    const autoComplete = wrapper.findComponent(AutoCompletePlusStub)
    expect(autoComplete.props('suggestions')).toEqual(mockUsers)
  })

  it('filters users using fuzzy search', async () => {
    const wrapper = createWrapper()
    await nextTick()

    const input = wrapper.find('#existing-user-select')
    await input.setValue('adm')
    await nextTick()

    const autoComplete = wrapper.findComponent(AutoCompletePlusStub)
    const suggestions = autoComplete.props('suggestions') as typeof mockUsers
    expect(suggestions.map((u) => u.username)).toContain('admin')
  })

  it('enables blur-on-option-select for existing user input', async () => {
    const wrapper = createWrapper()
    await nextTick()

    const autoComplete = wrapper.findComponent(AutoCompletePlusStub)
    expect(autoComplete.props('blurOnOptionSelect')).toBe(true)
  })

  it('shows all users after clearing input', async () => {
    const wrapper = createWrapper()
    await nextTick()

    const input = wrapper.find('#existing-user-select')
    await input.setValue('adm')
    await nextTick()

    const autoComplete = wrapper.findComponent(AutoCompletePlusStub)
    const filteredSuggestions = autoComplete.props(
      'suggestions'
    ) as typeof mockUsers
    expect(filteredSuggestions).not.toEqual(mockUsers)

    await input.setValue('')
    await nextTick()

    expect(autoComplete.props('suggestions')).toEqual(mockUsers)
  })
})

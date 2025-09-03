import { Form } from '@primevue/forms'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Checkbox from 'primevue/checkbox'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMesages from '@/locales/en/main.json'
import { IssueReportPanelProps } from '@/types/issueReportTypes'

import ReportIssuePanel from './ReportIssuePanel.vue'

const DEFAULT_FIELDS = ['Workflow', 'Logs', 'Settings', 'SystemStats']
const CUSTOM_FIELDS = [
  {
    label: 'Custom Field',
    value: 'CustomField',
    optIn: true,
    getData: () => 'mock data'
  }
]

async function getSubmittedContext() {
  const { captureMessage } = (await import('@sentry/core')) as any
  return captureMessage.mock.calls[0][1]
}

async function submitForm(wrapper: any) {
  await wrapper.findComponent(Form).trigger('submit')
  return getSubmittedContext()
}

async function findAndUpdateCheckbox(
  wrapper: any,
  value: string,
  checked = true
) {
  const checkbox = wrapper
    .findAllComponents(Checkbox)
    .find((c: any) => c.props('value') === value)
  if (!checkbox) throw new Error(`Checkbox with value "${value}" not found`)

  await checkbox.vm.$emit('update:modelValue', checked)
  return checkbox
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: enMesages
  }
})

vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({
    add: vi.fn()
  }))
}))

vi.mock('@/scripts/api', () => ({
  api: {
    getLogs: vi.fn().mockResolvedValue('mock logs'),
    getSystemStats: vi.fn().mockResolvedValue('mock stats'),
    getSettings: vi.fn().mockResolvedValue('mock settings'),
    fetchApi: vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue('')
    }),
    apiURL: vi.fn().mockReturnValue('https://test.com')
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    graph: {
      asSerialisable: vi.fn().mockReturnValue({})
    }
  }
}))

vi.mock('@sentry/core', () => ({
  captureMessage: vi.fn()
}))

vi.mock('@primevue/forms', () => ({
  Form: {
    name: 'Form',
    template:
      '<form @submit.prevent="onSubmit"><slot :values="formValues" /></form>',
    props: ['resolver'],
    data() {
      return {
        formValues: {}
      }
    },
    methods: {
      onSubmit() {
        // @ts-expect-error fixme ts strict error
        this.$emit('submit', {
          valid: true,
          // @ts-expect-error fixme ts strict error
          values: this.formValues
        })
      },
      updateFieldValue(name: string, value: any) {
        // @ts-expect-error fixme ts strict error
        this.formValues[name] = value
      }
    }
  },
  FormField: {
    name: 'FormField',
    template:
      '<div><slot :modelValue="modelValue" @update:modelValue="updateValue" /></div>',
    props: ['name'],
    data() {
      return {
        modelValue: ''
      }
    },
    methods: {
      // @ts-expect-error fixme ts strict error
      updateValue(value) {
        // @ts-expect-error fixme ts strict error
        this.modelValue = value
        // @ts-expect-error fixme ts strict error
        let parent = this.$parent
        while (parent && parent.$options.name !== 'Form') {
          parent = parent.$parent
        }
        if (parent) {
          // @ts-expect-error fixme ts strict error
          parent.updateFieldValue(this.name, value)
        }
      }
    }
  }
}))

vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: () => ({
    currentUser: {
      email: 'test@example.com'
    }
  })
}))

describe('ReportIssuePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  const mountComponent = (props: IssueReportPanelProps, options = {}): any => {
    return mount(ReportIssuePanel, {
      global: {
        plugins: [PrimeVue, i18n, createPinia()],
        directives: { tooltip: Tooltip }
      },
      props,
      ...options
    })
  }

  it('renders the panel with all required components', () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    expect(wrapper.find('.p-panel').exists()).toBe(true)
    expect(wrapper.findAllComponents(Checkbox).length).toBe(6)
    expect(wrapper.findComponent(InputText).exists()).toBe(true)
    expect(wrapper.findComponent(Textarea).exists()).toBe(true)
  })

  it('updates selection when checkboxes are selected', async () => {
    const wrapper = mountComponent({
      errorType: 'Test Error'
    })

    const checkboxes = wrapper.findAllComponents(Checkbox)

    for (const field of DEFAULT_FIELDS) {
      const checkbox = checkboxes.find(
        // @ts-expect-error fixme ts strict error
        (checkbox) => checkbox.props('value') === field
      )
      expect(checkbox).toBeDefined()

      await checkbox?.vm.$emit('update:modelValue', [field])
      expect(wrapper.vm.selection).toContain(field)
    }
  })

  it('updates contactInfo when input is changed', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    const input = wrapper.findComponent(InputText)

    await input.vm.$emit('update:modelValue', 'test@example.com')
    const context = await submitForm(wrapper)
    expect(context.user.email).toBe('test@example.com')
  })

  it('updates additional details when textarea is changed', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    const textarea = wrapper.findComponent(Textarea)

    await textarea.vm.$emit('update:modelValue', 'This is a test detail.')
    const context = await submitForm(wrapper)
    expect(context.extra.details).toBe('This is a test detail.')
  })

  it('set contact preferences back to false if email is removed', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    const input = wrapper.findComponent(InputText)

    // Set a valid email, enabling the contact preferences to be changed
    await input.vm.$emit('update:modelValue', 'name@example.com')

    // Enable both contact preferences
    for (const pref of ['followUp', 'notifyOnResolution']) {
      await findAndUpdateCheckbox(wrapper, pref)
    }

    // Change the email back to empty
    await input.vm.$emit('update:modelValue', '')
    const context = await submitForm(wrapper)

    // Check that the contact preferences are back to false automatically
    expect(context.tags.followUp).toBe(false)
    expect(context.tags.notifyOnResolution).toBe(false)
  })

  it('renders with overridden default fields', () => {
    const wrapper = mountComponent({
      errorType: 'Test Error',
      defaultFields: ['Settings']
    })

    // Filter out the contact preferences checkboxes
    const fieldCheckboxes = wrapper.findAllComponents(Checkbox).filter(
      // @ts-expect-error fixme ts strict error
      (checkbox) =>
        !['followUp', 'notifyOnResolution'].includes(checkbox.props('value'))
    )
    expect(fieldCheckboxes.length).toBe(1)
    expect(fieldCheckboxes.at(0)?.props('value')).toBe('Settings')
  })

  it('renders additional fields when extraFields prop is provided', () => {
    const wrapper = mountComponent({
      errorType: 'Test Error',
      extraFields: CUSTOM_FIELDS
    })
    const customCheckbox = wrapper
      .findAllComponents(Checkbox)
      // @ts-expect-error fixme ts strict error
      .find((checkbox) => checkbox.props('value') === 'CustomField')
    expect(customCheckbox).toBeDefined()
  })

  it('allows custom fields to be selected', async () => {
    const wrapper = mountComponent({
      errorType: 'Test Error',
      extraFields: CUSTOM_FIELDS
    })

    await findAndUpdateCheckbox(wrapper, 'CustomField')
    const context = await submitForm(wrapper)
    expect(context.extra.CustomField).toBe('mock data')
  })

  it('does not submit unchecked fields', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    const textarea = wrapper.findComponent(Textarea)

    // Set details but don't check any field checkboxes
    await textarea.vm.$emit(
      'update:modelValue',
      'Report with only text but no fields selected'
    )
    const context = await submitForm(wrapper)

    // Verify none of the optional fields were included
    for (const field of DEFAULT_FIELDS) {
      expect(context.extra[field]).toBeUndefined()
    }
  })

  it.each([
    {
      checkbox: 'Logs',
      apiMethod: 'getLogs',
      expectedKey: 'Logs',
      mockValue: 'mock logs'
    },
    {
      checkbox: 'SystemStats',
      apiMethod: 'getSystemStats',
      expectedKey: 'SystemStats',
      mockValue: 'mock stats'
    },
    {
      checkbox: 'Settings',
      apiMethod: 'getSettings',
      expectedKey: 'Settings',
      mockValue: 'mock settings'
    }
  ])(
    'submits $checkbox data when checkbox is selected',
    async ({ checkbox, apiMethod, expectedKey, mockValue }) => {
      const wrapper = mountComponent({ errorType: 'Test Error' })

      const { api } = (await import('@/scripts/api')) as any
      vi.spyOn(api, apiMethod).mockResolvedValue(mockValue)

      await findAndUpdateCheckbox(wrapper, checkbox)
      const context = await submitForm(wrapper)
      expect(context.extra[expectedKey]).toBe(mockValue)
    }
  )

  it('submits workflow when the Workflow checkbox is selected', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })

    const { app } = (await import('@/scripts/app')) as any
    const mockWorkflow = { nodes: [], edges: [] }
    vi.spyOn(app.graph, 'asSerialisable').mockReturnValue(mockWorkflow)

    await findAndUpdateCheckbox(wrapper, 'Workflow')
    const context = await submitForm(wrapper)

    expect(context.extra.Workflow).toEqual(mockWorkflow)
  })
})

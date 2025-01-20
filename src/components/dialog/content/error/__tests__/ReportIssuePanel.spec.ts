// @ts-strict-ignore
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import Panel from 'primevue/panel'
import Textarea from 'primevue/textarea'
import Tooltip from 'primevue/tooltip'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'

import CheckboxGroup from '@/components/common/CheckboxGroup.vue'
import enMesages from '@/locales/en/main.json'
import { DefaultField, ReportField } from '@/types/issueReportTypes'

import ReportIssuePanel from '../ReportIssuePanel.vue'

type ReportIssuePanelProps = {
  errorType: string
  defaultFields?: DefaultField[]
  extraFields?: ReportField[]
  tags?: Record<string, string>
  title?: string
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
    getSettings: vi.fn().mockResolvedValue('mock settings')
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

describe('ReportIssuePanel', () => {
  beforeAll(() => {
    const app = createApp({})
    app.use(PrimeVue)
  })

  const mountComponent = (props: ReportIssuePanelProps, options = {}): any => {
    return mount(ReportIssuePanel, {
      global: {
        plugins: [PrimeVue, createTestingPinia(), i18n],
        directives: { tooltip: Tooltip },
        components: { InputText, Button, Panel, Textarea, CheckboxGroup }
      },
      props,
      ...options
    })
  }

  it('renders the panel with all required components', () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    expect(wrapper.find('.p-panel').exists()).toBe(true)
    expect(wrapper.findAllComponents(CheckboxGroup).length).toBe(2)
    expect(wrapper.findComponent(InputText).exists()).toBe(true)
    expect(wrapper.findComponent(Textarea).exists()).toBe(true)
    expect(wrapper.findComponent(Button).exists()).toBe(true)
  })

  it('updates selection when checkboxes are selected', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    const checkboxes = wrapper.findAllComponents(CheckboxGroup).at(0)
    await checkboxes?.setValue(['Workflow', 'Logs'])
    expect(wrapper.vm.selection).toEqual(['Workflow', 'Logs'])
  })

  it('updates contactInfo when input is changed', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    const input = wrapper.findComponent(InputText)
    await input.setValue('test@example.com')
    expect(wrapper.vm.contactInfo).toBe('test@example.com')
  })

  it('updates additional details when textarea is changed', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    const textarea = wrapper.findComponent(Textarea)
    await textarea.setValue('This is a test detail.')
    expect(wrapper.vm.details).toBe('This is a test detail.')
  })

  it('updates contactPrefs when preferences are selected', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    const preferences = wrapper.findAllComponents(CheckboxGroup).at(1)
    await preferences?.setValue(['FollowUp'])
    expect(wrapper.vm.contactPrefs).toEqual(['FollowUp'])
  })

  it('does not allow submission if the form is empty', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    await wrapper.vm.reportIssue()
    expect(wrapper.vm.submitted).toBe(false)
  })

  it('renders with overridden default fields', () => {
    const wrapper = mountComponent({
      errorType: 'Test Error',
      defaultFields: ['Settings']
    })
    const checkboxes = wrapper.findAllComponents(CheckboxGroup).at(0)
    expect(checkboxes?.props('checkboxes')).toEqual([
      { label: 'Settings', value: 'Settings' }
    ])
  })

  it('renders additional fields when extraFields prop is provided', () => {
    const extraFields = [
      { label: 'Custom Field', value: 'CustomField', optIn: true, data: {} }
    ]
    const wrapper = mountComponent({ errorType: 'Test Error', extraFields })
    const checkboxes = wrapper.findAllComponents(CheckboxGroup).at(0)
    expect(checkboxes?.props('checkboxes')).toContainEqual({
      label: 'Custom Field',
      value: 'CustomField'
    })
  })

  it('does not submit unchecked fields', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })
    const textarea = wrapper.findComponent(Textarea)

    await textarea.setValue('Report with only text but no fields selected')
    await wrapper.vm.reportIssue()

    const { captureMessage } = (await import('@sentry/core')) as any
    const captureContext = captureMessage.mock.calls[0][1]

    expect(captureContext.extra.logs).toBeNull()
    expect(captureContext.extra.systemStats).toBeNull()
    expect(captureContext.extra.settings).toBeNull()
    expect(captureContext.extra.workflow).toBeNull()
  })

  it.each([
    {
      checkbox: 'Logs',
      apiMethod: 'getLogs',
      expectedKey: 'logs',
      mockValue: 'mock logs'
    },
    {
      checkbox: 'SystemStats',
      apiMethod: 'getSystemStats',
      expectedKey: 'systemStats',
      mockValue: 'mock stats'
    },
    {
      checkbox: 'Settings',
      apiMethod: 'getSettings',
      expectedKey: 'settings',
      mockValue: 'mock settings'
    }
  ])(
    'submits (%s) when the (%s) checkbox is selected',
    async ({ checkbox, apiMethod, expectedKey, mockValue }) => {
      const wrapper = mountComponent({ errorType: 'Test Error' })

      const { api } = (await import('@/scripts/api')) as any
      vi.spyOn(api, apiMethod).mockResolvedValue(mockValue)

      const { captureMessage } = await import('@sentry/core')

      // Select the checkbox
      const checkboxes = wrapper.findAllComponents(CheckboxGroup).at(0)
      await checkboxes?.vm.$emit('update:modelValue', [checkbox])

      await wrapper.vm.reportIssue()
      expect(api[apiMethod]).toHaveBeenCalled()

      // Verify the message includes the associated data
      expect(captureMessage).toHaveBeenCalledWith(
        'User reported issue',
        expect.objectContaining({
          extra: expect.objectContaining({ [expectedKey]: mockValue })
        })
      )
    }
  )

  it('submits workflow when the Workflow checkbox is selected', async () => {
    const wrapper = mountComponent({ errorType: 'Test Error' })

    const { app } = (await import('@/scripts/app')) as any
    const { captureMessage } = await import('@sentry/core')

    const mockWorkflow = { nodes: [], edges: [] }
    vi.spyOn(app.graph, 'asSerialisable').mockReturnValue(mockWorkflow)

    // Select the "Workflow" checkbox
    const checkboxes = wrapper.findAllComponents(CheckboxGroup).at(0)
    await checkboxes?.vm.$emit('update:modelValue', ['Workflow'])

    await wrapper.vm.reportIssue()
    expect(app.graph.asSerialisable).toHaveBeenCalled()

    // Verify the message includes the workflow
    expect(captureMessage).toHaveBeenCalledWith(
      'User reported issue',
      expect.objectContaining({
        extra: expect.objectContaining({ workflow: mockWorkflow })
      })
    )
  })
})

// @ts-strict-ignore
import { mount } from '@vue/test-utils'
import Card from 'primevue/card'
import PrimeVue from 'primevue/config'
import Rating from 'primevue/rating'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import FeedbackDialogContent from '../FeedbackDialogContent.vue'
import ReportIssuePanel from '../error/ReportIssuePanel.vue'

vi.mock('@/components/error/ReportIssuePanel.vue', () => ({
  default: {
    name: 'ReportIssuePanel',
    props: ['errorType', 'title', 'extraFields', 'defaultFields'],
    template: '<div><slot /></div>'
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: enMessages
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

describe('FeedbackPanel', () => {
  beforeAll(() => {
    const app = createApp({})
    app.use(PrimeVue)
    app.use(i18n)
  })

  const mountComponent = (): any =>
    mount(FeedbackDialogContent, {
      global: {
        plugins: [PrimeVue, i18n],
        components: { Card, Rating, ReportIssuePanel }
      }
    })

  it('renders the Card with the correct header', () => {
    const wrapper = mountComponent()
    expect(wrapper.findComponent(Card).exists()).toBe(true)
    expect(wrapper.find('h3').text()).toBe(enMessages.menuLabels.Feedback)
  })

  it('renders the Rating component', () => {
    const wrapper = mountComponent()
    expect(wrapper.findComponent(Rating).exists()).toBe(true)
  })

  it('initializes the rating value to null', () => {
    const wrapper = mountComponent()
    expect(wrapper.vm.rating).toBeNull()
  })

  it('updates the rating value when a rating is selected', async () => {
    const wrapper = mountComponent()
    const ratingComponent = wrapper.findComponent(Rating)

    await ratingComponent.vm.$emit('update:modelValue', 4)
    expect(wrapper.vm.rating).toBe(4)
  })

  it('renders the ReportIssuePanel with the correct props', () => {
    const wrapper = mountComponent()
    const reportIssuePanel = wrapper.findComponent(ReportIssuePanel)

    expect(reportIssuePanel.exists()).toBe(true)
    expect(reportIssuePanel.props()).toMatchObject({
      errorType: 'Feedback',
      title: "We'd love to hear about your experience with ComfyUI",
      defaultFields: ['SystemStats', 'Settings'],
      extraFields: expect.arrayContaining([
        expect.objectContaining({
          label: 'rating',
          value: 'Rating',
          optIn: false,
          data: { rating: null }
        })
      ])
    })
  })

  it('updates the extraFields rating when the rating is changed', async () => {
    const wrapper = mountComponent()
    const ratingComponent = wrapper.findComponent(Rating)
    const reportIssuePanel = wrapper.findComponent(ReportIssuePanel)

    // Set a new rating value
    await ratingComponent.vm.$emit('update:modelValue', 5)

    // Check that the extraFields prop on ReportIssuePanel updates
    const extraFields = reportIssuePanel.props('extraFields')
    expect(extraFields).toContainEqual(
      expect.objectContaining({
        label: 'rating',
        value: 'Rating',
        optIn: false,
        data: { rating: 5 }
      })
    )
  })
})

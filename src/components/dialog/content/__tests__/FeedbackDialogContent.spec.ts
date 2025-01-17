// @ts-strict-ignore
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { ReportField } from '@/types/issueReportTypes'

import FeedbackDialogContent from '../FeedbackDialogContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: enMessages
  }
})

vi.mock('@/components/error/ReportIssuePanel.vue', () => ({
  default: {
    name: 'ReportIssuePanel',
    props: ['errorType', 'title', 'extraFields', 'defaultFields'],
    template: '<div><slot /></div>'
  }
}))

vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({
    add: vi.fn()
  }))
}))

describe('FeedbackDialogContent', () => {
  beforeAll(() => {
    const app = createApp({})
    app.use(PrimeVue)
    app.use(i18n)
  })

  const mountComponent = (): any =>
    mount(FeedbackDialogContent, {
      global: {
        plugins: [PrimeVue, i18n],
        directives: { tooltip: Tooltip }
      }
    })

  it('initializes rating to null', () => {
    const wrapper = mountComponent()
    expect(wrapper.vm.rating).toBeNull()
  })

  it('updates rating when a star is clicked', async () => {
    const wrapper = mountComponent()
    const ratingComponent = wrapper.findComponent({ name: 'Rating' })

    // Click the 4th start (out of 5)
    await ratingComponent.findAll('i').at(3)?.trigger('click')

    // Verify the rating has been updated
    expect(wrapper.vm.rating).toBe(4)
  })

  it('passes correct props to ReportIssuePanel', () => {
    const wrapper = mountComponent()
    const reportIssuePanel = wrapper.findComponent({ name: 'ReportIssuePanel' })

    expect(reportIssuePanel.props()).toMatchObject({
      errorType: 'Feedback',
      title: enMessages['issueReport']['feedbackTitle'],
      defaultFields: ['SystemStats', 'Settings']
    })
  })

  it('includes rating in extraFields when updated', async () => {
    const wrapper = mountComponent()
    const reportIssuePanel = wrapper.findComponent({ name: 'ReportIssuePanel' })

    // Click the 5th star (out of 5)
    const ratingComponent = wrapper.findComponent({ name: 'Rating' })
    await ratingComponent.findAll('i').at(4)?.trigger('click')

    const expectedExtraFields: ReportField[] = [
      {
        label: 'rating',
        value: 'Rating',
        optIn: false,
        data: { rating: 5 }
      }
    ]
    expect(reportIssuePanel.props('extraFields')).toEqual(expectedExtraFields)
  })

  it('includes rating in extraFields as null when no rating is selected', () => {
    const wrapper = mountComponent()
    const reportIssuePanel = wrapper.findComponent({ name: 'ReportIssuePanel' })

    const expectedExtraFields: ReportField[] = [
      {
        label: 'rating',
        value: 'Rating',
        optIn: false,
        data: { rating: null }
      }
    ]
    expect(reportIssuePanel.props('extraFields')).toEqual(expectedExtraFields)
  })

  it('resets the rating to null on re-render', async () => {
    const wrapper = mountComponent()

    // Simulate rating selection
    wrapper.vm.rating = 4
    expect(wrapper.vm.rating).toBe(4)

    // Re-mount the component
    wrapper.unmount()
    const newWrapper = mountComponent()

    // Verify rating is reset
    expect(newWrapper.vm.rating).toBeNull()
  })

  it('passes all expected extraFields to ReportIssuePanel', () => {
    const wrapper = mountComponent()
    const reportIssuePanel = wrapper.findComponent({ name: 'ReportIssuePanel' })

    const extraFields = reportIssuePanel.props('extraFields') as ReportField[]

    expect(extraFields).toContainEqual(
      expect.objectContaining({
        label: 'rating',
        value: 'Rating',
        optIn: false,
        data: { rating: null }
      })
    )
  })
})

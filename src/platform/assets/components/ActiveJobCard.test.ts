import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ActiveJobCard from './ActiveJobCard.vue'

import type { JobListItem } from '@/composables/queue/useJobList'

vi.mock('@/composables/useProgressBarBackground', () => ({
  useProgressBarBackground: () => ({
    progressBarPrimaryClass: 'bg-blue-500',
    hasProgressPercent: (val: number | undefined) => typeof val === 'number',
    progressPercentStyle: (val: number) => ({ width: `${val}%` })
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      sideToolbar: {
        activeJobStatus: 'Active job: {status}'
      }
    }
  }
})

const createJob = (overrides: Partial<JobListItem> = {}): JobListItem => ({
  id: 'test-job-1',
  title: 'Running...',
  meta: 'Step 5/10',
  state: 'running',
  progressTotalPercent: 50,
  progressCurrentPercent: 75,
  ...overrides
})

const mountComponent = (job: JobListItem) =>
  mount(ActiveJobCard, {
    props: { job },
    global: {
      plugins: [i18n]
    }
  })

describe('ActiveJobCard', () => {
  it('displays percentage and progress bar when job is running', () => {
    const wrapper = mountComponent(
      createJob({ state: 'running', progressTotalPercent: 65 })
    )

    expect(wrapper.text()).toContain('65%')
    const progressBar = wrapper.find('.bg-blue-500')
    expect(progressBar.exists()).toBe(true)
    expect(progressBar.attributes('style')).toContain('width: 65%')
  })

  it('displays status text when job is pending', () => {
    const wrapper = mountComponent(
      createJob({
        state: 'pending',
        title: 'In queue...',
        progressTotalPercent: undefined
      })
    )

    expect(wrapper.text()).toContain('In queue...')
    const progressBar = wrapper.find('.bg-blue-500')
    expect(progressBar.exists()).toBe(false)
  })

  it('shows spinner for pending state', () => {
    const wrapper = mountComponent(createJob({ state: 'pending' }))

    const spinner = wrapper.find('.icon-\\[lucide--loader-circle\\]')
    expect(spinner.exists()).toBe(true)
    expect(spinner.classes()).toContain('animate-spin')
  })

  it('shows error icon for failed state', () => {
    const wrapper = mountComponent(
      createJob({ state: 'failed', title: 'Failed' })
    )

    const errorIcon = wrapper.find('.icon-\\[lucide--circle-alert\\]')
    expect(errorIcon.exists()).toBe(true)
    expect(wrapper.text()).toContain('Failed')
  })

  it('shows preview image when running with iconImageUrl', () => {
    const wrapper = mountComponent(
      createJob({
        state: 'running',
        iconImageUrl: 'https://example.com/preview.jpg'
      })
    )

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/preview.jpg')
  })

  it('has proper accessibility attributes', () => {
    const wrapper = mountComponent(createJob({ title: 'Generating...' }))

    const container = wrapper.find('[role="status"]')
    expect(container.exists()).toBe(true)
    expect(container.attributes('aria-label')).toBe('Active job: Generating...')
  })
})

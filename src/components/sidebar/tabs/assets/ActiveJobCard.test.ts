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
  it('renders status text from job title', () => {
    const wrapper = mountComponent(createJob({ title: 'Processing...' }))

    expect(wrapper.text()).toContain('Processing...')
  })

  it('displays progress bar when job is running with progress', () => {
    const wrapper = mountComponent(
      createJob({ state: 'running', progressTotalPercent: 65 })
    )

    const progressBar = wrapper.find('.bg-blue-500')
    expect(progressBar.exists()).toBe(true)
    expect(progressBar.attributes('style')).toContain('width: 65%')
  })

  it('hides progress bar when job is pending', () => {
    const wrapper = mountComponent(
      createJob({ state: 'pending', progressTotalPercent: undefined })
    )

    const progressBar = wrapper.find('.bg-blue-500')
    expect(progressBar.exists()).toBe(false)
  })

  it('has proper accessibility attributes', () => {
    const wrapper = mountComponent(createJob({ title: 'Generating...' }))

    const container = wrapper.find('[role="status"]')
    expect(container.exists()).toBe(true)
    expect(container.attributes('aria-label')).toBe('Active job: Generating...')
  })

  it('displays spinner icon in thumbnail area', () => {
    const wrapper = mountComponent(createJob())

    const spinner = wrapper.find('.icon-\\[lucide--loader-circle\\]')
    expect(spinner.exists()).toBe(true)
    expect(spinner.classes()).toContain('animate-spin')
  })
})

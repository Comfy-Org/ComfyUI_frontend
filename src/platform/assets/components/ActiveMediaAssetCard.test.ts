import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ActiveJobCard from './ActiveMediaAssetCard.vue'

import type { JobListItem } from '@/composables/queue/useJobList'

const mockRunCancelJob = vi.fn()
const mockRunDeleteJob = vi.fn()
const mockCanCancelJob = ref(false)
const mockCanDeleteJob = ref(false)

vi.mock('@/composables/queue/useJobActions', () => ({
  useJobActions: () => ({
    cancelAction: {
      icon: 'icon-[lucide--x]',
      label: 'Cancel',
      variant: 'destructive'
    },
    canCancelJob: mockCanCancelJob,
    runCancelJob: mockRunCancelJob,
    deleteAction: {
      icon: 'icon-[lucide--circle-minus]',
      label: 'Remove job',
      variant: 'destructive'
    },
    canDeleteJob: mockCanDeleteJob,
    runDeleteJob: mockRunDeleteJob
  })
}))

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

function renderComponent(job: JobListItem) {
  const user = userEvent.setup()
  const { container } = render(ActiveJobCard, {
    props: { job },
    global: {
      plugins: [i18n]
    }
  })
  return { container, user }
}

describe('ActiveJobCard', () => {
  beforeEach(() => {
    mockCanCancelJob.value = false
    mockCanDeleteJob.value = false
    mockRunCancelJob.mockReset()
    mockRunDeleteJob.mockReset()
  })

  it('displays percentage and progress bar when job is running', () => {
    const { container } = renderComponent(
      createJob({ state: 'running', progressTotalPercent: 65 })
    )

    expect(container.textContent).toContain('65%')
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- progress bar has no ARIA role in happy-dom
    const progressBar = container.querySelector('.bg-blue-500')
    expect(progressBar).not.toBeNull()
    expect(progressBar).toHaveStyle({ width: '65%' })
  })

  it('displays status text when job is pending', () => {
    const { container } = renderComponent(
      createJob({
        state: 'pending',
        title: 'In queue...',
        progressTotalPercent: undefined
      })
    )

    expect(container.textContent).toContain('In queue...')
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- progress bar has no ARIA role in happy-dom
    expect(container.querySelector('.bg-blue-500')).toBeNull()
  })

  it('shows spinner for pending state', () => {
    const { container } = renderComponent(createJob({ state: 'pending' }))

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- spinner icon has no ARIA role in happy-dom
    const spinner = container.querySelector('[class*="lucide--loader-circle"]')
    expect(spinner).not.toBeNull()
    expect(spinner).toHaveClass('animate-spin')
  })

  it('shows error icon for failed state', () => {
    const { container } = renderComponent(
      createJob({ state: 'failed', title: 'Failed' })
    )

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- error icon has no ARIA role in happy-dom
    const errorIcon = container.querySelector('[class*="lucide--circle-alert"]')
    expect(errorIcon).not.toBeNull()
    expect(container.textContent).toContain('Failed')
  })

  it('shows preview image when running with iconImageUrl', () => {
    renderComponent(
      createJob({
        state: 'running',
        iconImageUrl: 'https://example.com/preview.jpg'
      })
    )

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/preview.jpg')
  })

  it('has proper accessibility attributes', () => {
    renderComponent(createJob({ title: 'Generating...' }))

    const status = screen.getByRole('status', {
      name: 'Active job: Generating...'
    })
    expect(status).toBeInTheDocument()
  })

  it('shows delete button on hover for failed jobs', async () => {
    mockCanDeleteJob.value = true

    const { user } = renderComponent(
      createJob({ state: 'failed', title: 'Failed' })
    )

    expect(
      screen.queryByRole('button', { name: 'Remove job' })
    ).not.toBeInTheDocument()

    await user.hover(screen.getByRole('status'))

    expect(
      screen.getByRole('button', { name: 'Remove job' })
    ).toBeInTheDocument()
  })

  it('calls runDeleteJob when delete button is clicked on a failed job', async () => {
    mockCanDeleteJob.value = true

    const { user } = renderComponent(
      createJob({ state: 'failed', title: 'Failed' })
    )

    await user.hover(screen.getByRole('status'))
    await user.click(screen.getByRole('button', { name: 'Remove job' }))

    expect(mockRunDeleteJob).toHaveBeenCalledOnce()
  })

  it('does not show action button when job cannot be cancelled or deleted', async () => {
    const { user } = renderComponent(
      createJob({ state: 'running', progressTotalPercent: 50 })
    )

    await user.hover(screen.getByRole('status', { name: /Active job/ }))

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows cancel button on hover for cancellable jobs', async () => {
    mockCanCancelJob.value = true

    const { user } = renderComponent(
      createJob({ state: 'running', progressTotalPercent: 50 })
    )

    await user.hover(screen.getByRole('status', { name: /Active job/ }))

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('calls runCancelJob when cancel button is clicked', async () => {
    mockCanCancelJob.value = true

    const { user } = renderComponent(
      createJob({ state: 'running', progressTotalPercent: 50 })
    )

    await user.hover(screen.getByRole('status', { name: /Active job/ }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mockRunCancelJob).toHaveBeenCalledOnce()
  })
})

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import QueueOverlayActive from './QueueOverlayActive.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      sideToolbar: {
        queueProgressOverlay: {
          total: 'Total: {percent}',
          currentNode: 'Current node:',
          running: 'running',
          interruptAll: 'Interrupt all running jobs',
          queuedSuffix: 'queued',
          clearQueued: 'Clear queued',
          viewAllJobs: 'View all jobs',
          cancelJobTooltip: 'Cancel job',
          clearQueueTooltip: 'Clear queue'
        }
      }
    }
  }
})

const BaseTooltipStub = {
  template: '<slot />'
}

const defaultProps = {
  totalProgressStyle: { width: '65%' },
  currentNodeProgressStyle: { width: '40%' },
  totalPercentFormatted: '65%',
  currentNodePercentFormatted: '40%',
  currentNodeName: 'Sampler',
  runningCount: 1,
  queuedCount: 2,
  bottomRowClass: 'flex custom-bottom-row'
}

const renderComponent = (props: Record<string, unknown> = {}) =>
  render(QueueOverlayActive, {
    props: { ...defaultProps, ...props },
    global: {
      plugins: [i18n],
      stubs: {
        BaseTooltip: BaseTooltipStub
      }
    }
  })

describe('QueueOverlayActive', () => {
  it('renders progress metrics and emits actions when buttons clicked', async () => {
    const user = userEvent.setup()
    const interruptAllSpy = vi.fn()
    const clearQueuedSpy = vi.fn()
    const viewAllJobsSpy = vi.fn()

    const { container } = renderComponent({
      runningCount: 2,
      queuedCount: 3,
      onInterruptAll: interruptAllSpy,
      onClearQueued: clearQueuedSpy,
      onViewAllJobs: viewAllJobsSpy
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const progressBars = container.querySelectorAll('.absolute.inset-0')
    expect(progressBars[0]).toHaveStyle({ width: '65%' })
    expect(progressBars[1]).toHaveStyle({ width: '40%' })

    expect(screen.getByText('65%')).toBeInTheDocument()

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('queued')).toBeInTheDocument()

    expect(screen.getByText('Current node:')).toBeInTheDocument()
    expect(screen.getByText('Sampler')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Interrupt all running jobs' })
    )
    expect(interruptAllSpy).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Clear queued' }))
    expect(clearQueuedSpy).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'View all jobs' }))
    expect(viewAllJobsSpy).toHaveBeenCalledOnce()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.custom-bottom-row')).toBeTruthy()
  })

  it('hides action buttons when counts are zero', () => {
    renderComponent({ runningCount: 0, queuedCount: 0 })

    expect(
      screen.queryByRole('button', { name: 'Interrupt all running jobs' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Clear queued' })
    ).not.toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import JobHistoryStatusWidgets from './JobHistoryStatusWidgets.vue'

function renderWidgets(props: { queuedCount: number; runningCount: number }) {
  return render(JobHistoryStatusWidgets, {
    props,
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })
}

describe('JobHistoryStatusWidgets', () => {
  it('emits clearQueued from the queued count button', async () => {
    const user = userEvent.setup()
    const clearQueuedSpy = vi.fn()

    render(JobHistoryStatusWidgets, {
      props: {
        queuedCount: 3,
        runningCount: 0,
        onClearQueued: clearQueuedSpy
      },
      global: {
        plugins: [i18n],
        directives: { tooltip: () => {} }
      }
    })

    await user.click(screen.getByRole('button', { name: 'Clear queue' }))

    expect(clearQueuedSpy).toHaveBeenCalledOnce()
  })

  it('shows the running count with an accessible label', () => {
    renderWidgets({ queuedCount: 0, runningCount: 2 })

    expect(screen.getByLabelText('2 running')).toBeInTheDocument()
  })

  it('renders no widgets when no jobs are active', () => {
    const { container } = renderWidgets({ queuedCount: 0, runningCount: 0 })

    expect(container).toBeEmptyDOMElement()
  })
})

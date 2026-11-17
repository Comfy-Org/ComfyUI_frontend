import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { createFakePointHost } from './fakePointHost'
import { historyKey } from './historyStorage'
import { messages } from './messages'
import { mountPointLayer } from './mountPointLayer'

function mount({ selects = false } = {}) {
  const host = createFakePointHost()
  host.workflow = 'workflow-w'
  if (selects) host.selection = [host.nodes[1].id]
  const remove = mountPointLayer(host)
  onTestFinished(remove)
  return remove
}

describe('mountPointLayer', () => {
  it('HS-01: the mounted layer keeps the history in the browser’s own storage and shows it again on the next page load', async () => {
    onTestFinished(() => window.localStorage.clear())
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const remove = mount({ selects: true })
    await user.click(screen.getByRole('button', { name: messages.tipsLabel }))
    await user.click(screen.getByRole('button', { name: messages.tipsStart }))
    await user.click(
      screen.getByRole('textbox', { name: messages.commentLabel })
    )
    await user.keyboard('what is this?{Enter}')

    expect(window.localStorage.getItem(historyKey('workflow-w'))).toContain(
      'what is this?'
    )

    remove()
    mount()
    await vi.advanceTimersByTimeAsync(50)

    expect(
      screen.getByRole('button', {
        name: messages.pinLabel(1, 'Empty Latent Image')
      })
    ).toBeInTheDocument()
  })
})

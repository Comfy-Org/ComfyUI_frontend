import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { pointConfig } from './config'
import type { PointConfig } from './config'
import { createFakePointHost } from './fakePointHost'
import { fakeBrowserStorage } from './historyFixtures'
import { createHistoryKeeper } from './historyKeeper'
import { historyNotice } from './historyNotice'
import { messages } from './messages'
import { isOwnElement } from './pageElements'
import PointRoot from './PointRoot.vue'

const ASKED_ABOUT = 'Empty Latent Image'
const config: PointConfig = {
  ...pointConfig,
  agent: 'scripted',
  scripted: { replyDelayMs: 100, wrongTarget: false },
  companion: false
}
const settings = {
  enabled: true,
  maxCharsPerWorkflow: 100_000,
  maxWorkflows: 20
}

/** One page load on the same browser storage; `selects` makes Ask open on that node. */
function openPage(
  storage: ReturnType<typeof fakeBrowserStorage>,
  { selects = false } = {}
) {
  const host = createFakePointHost()
  host.workflow = 'workflow-w'
  if (selects) host.selection = [host.nodes[1].id]
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const rendered = render(PointRoot, {
    props: {
      host,
      config,
      history: createHistoryKeeper(() => storage, settings)
    }
  })
  return { host, user, ...rendered }
}

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('button', { name: messages.annotate }))
  await user.click(screen.getByRole('textbox', { name: messages.commentLabel }))
  await user.keyboard(text)
}

describe('PointRoot: the history through the real layer', () => {
  it('HS-01: a question that was asked and answered is on the canvas again after a reload, and its thread opens', async () => {
    const storage = fakeBrowserStorage()
    const first = openPage(storage, { selects: true })
    await ask(first.user, 'make this wider{Control>}{Enter}{/Control}')
    await vi.advanceTimersByTimeAsync(200)
    expect(screen.getByTestId('point-at-it-bubble')).toBeInTheDocument()
    first.unmount()

    const { user } = openPage(storage)
    await vi.advanceTimersByTimeAsync(50)

    expect(screen.queryByTestId('point-at-it-bubble')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: messages.answeredPinLabel(1, ASKED_ABOUT)
      })
    )
    expect(
      within(screen.getByTestId('point-at-it-bubble')).getByRole('log', {
        name: messages.threadLabel
      })
    ).toHaveTextContent('make this wider')
  })

  it('HS-01: a question that was added and not sent is still pinned and unsent after a reload', async () => {
    const storage = fakeBrowserStorage()
    const first = openPage(storage, { selects: true })
    await ask(first.user, 'what is this?{Enter}')
    first.unmount()

    openPage(storage)
    await vi.advanceTimersByTimeAsync(50)

    expect(
      screen.getByRole('button', { name: messages.pinLabel(1, ASKED_ABOUT) })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(messages.unsentCount(1))).toBeInTheDocument()
  })

  it('HS-17, BA-22: says so at the top centre of the canvas, away from the Ask strip, while the history cannot be saved, and stops saying it once a save works', async () => {
    const storage = fakeBrowserStorage()
    storage.isFull = true
    const { user } = openPage(storage, { selects: true })
    expect(screen.queryByTestId('point-at-it-unsaved')).not.toBeInTheDocument()

    await ask(user, 'what is this?{Enter}')

    const notice = screen.getByTestId('point-at-it-unsaved')
    expect(notice).toHaveTextContent(historyNotice.notSaved)
    expect(notice).toHaveAttribute('role', 'status')
    expect(isOwnElement(notice)).toBe(true)
    expect(notice).toHaveStyle({ top: '8px' })
    expect(screen.getByTestId('point-at-it-ask')).not.toContainElement(notice)
    expect(
      screen.getByRole('button', { name: messages.pinLabel(1, ASKED_ABOUT) })
    ).toBeInTheDocument()

    storage.isFull = false
    await user.click(
      screen.getByRole('button', { name: messages.pinLabel(1, ASKED_ABOUT) })
    )
    await user.keyboard(' and why?{Enter}')

    expect(screen.queryByTestId('point-at-it-unsaved')).not.toBeInTheDocument()
    expect(storage.entries.size).toBe(1)
  })
})

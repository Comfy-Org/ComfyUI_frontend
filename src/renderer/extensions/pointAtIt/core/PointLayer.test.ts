import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { pointConfig } from './config'
import type { PointConfig } from './config'
import { placeAfterMarker } from './dockSlot'
import { createFakePointHost } from './fakePointHost'
import { messages } from './messages'
import { isOwnElement } from './pageElements'
import PointLayer from './PointLayer.vue'

const TOP_BAR =
  '<div data-testid="bar"><button>User</button><span data-testid="separator"></span><button>Agent</button></div>'
const config: PointConfig = { ...pointConfig, agent: 'scripted' }

function renderLayer(page: string) {
  document.body.innerHTML = page
  const host = createFakePointHost()
  host.topBarPlace = (own) =>
    placeAfterMarker(own, '[data-testid="bar"]', '[data-testid="separator"]')
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  return { user, ...render(PointLayer, { props: { host, config } }) }
}

function annotate() {
  return screen.getByRole('button', { name: messages.annotate })
}

describe('PointLayer: the trigger and its panel', () => {
  it('P-01: the trigger sits in the top bar directly left of the Agent entry button', async () => {
    renderLayer(TOP_BAR)
    await nextTick()

    const inBar = within(screen.getByTestId('bar')).getAllByRole('button')

    expect(inBar.map((button) => button.textContent.trim())).toEqual([
      'User',
      messages.annotate,
      '',
      'Agent'
    ])
    expect(inBar[2]).toHaveAccessibleName(messages.showPanel)
  })

  it('P-02: without the top bar the trigger still shows and works', async () => {
    const { user } = renderLayer('')

    await user.click(annotate())

    expect(annotate()).toHaveAttribute('aria-pressed', 'true')
  })

  it('P-04, P-05: one click turns the mode on and opens the panel; the next turns it off and closes the empty panel', async () => {
    const { user } = renderLayer(TOP_BAR)

    await user.click(annotate())
    expect(annotate()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('point-at-it-capture')).toBeInTheDocument()
    expect(screen.getByTestId('point-at-it-panel')).toBeInTheDocument()

    await user.click(annotate())
    expect(annotate()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('point-at-it-capture')).not.toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
  })

  it('P-06: the caret opens the panel for reading without turning the mode on', async () => {
    const { user } = renderLayer(TOP_BAR)

    await user.click(screen.getByRole('button', { name: messages.showPanel }))

    expect(screen.getByTestId('point-at-it-panel')).toBeInTheDocument()
    expect(annotate()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('point-at-it-capture')).not.toBeInTheDocument()
  })

  it('P-08: the panel’s own collapse control hides it and leaves the mode on', async () => {
    const { user } = renderLayer(TOP_BAR)
    await user.click(annotate())

    await user.click(
      within(screen.getByTestId('point-at-it-panel')).getByRole('button', {
        name: messages.hidePanel
      })
    )

    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
    expect(annotate()).toHaveAttribute('aria-pressed', 'true')
  })

  it('P-15: the trigger and the panel count as the layer’s own, so neither can be picked', async () => {
    const { user } = renderLayer(TOP_BAR)
    await user.click(annotate())

    expect(isOwnElement(annotate())).toBe(true)
    expect(isOwnElement(screen.getByTestId('point-at-it-panel'))).toBe(true)
    expect(isOwnElement(screen.getByText('Agent'))).toBe(false)
  })
})

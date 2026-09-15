// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import InfoTooltip from './InfoTooltip.vue'

const note = 'Actual cost varies with settings and usage.'
const label = 'How this estimate is reached'

describe('InfoTooltip', () => {
  it('opens the note for a keyboard, not only for a pointer', async () => {
    const user = userEvent.setup()
    render(InfoTooltip, { props: { text: note, label } })

    expect(screen.queryAllByText(note)).toHaveLength(0)

    await user.tab()
    expect(screen.getByRole('button', { name: label })).toHaveFocus()
    const [shown] = await screen.findAllByText(note)
    expect(shown).toBeVisible()
  })

  it('opens the note on tap, where touch devices have no hover', async () => {
    const user = userEvent.setup()
    render(InfoTooltip, { props: { text: note, label } })

    expect(screen.queryAllByText(note)).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: label }))
    const [shown] = await screen.findAllByText(note)
    expect(shown).toBeVisible()
  })

  it('dismisses the tapped note when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(InfoTooltip, { props: { text: note, label } })

    await user.click(screen.getByRole('button', { name: label }))
    await screen.findAllByText(note)

    await user.keyboard('{Escape}')
    await vi.waitFor(() => expect(screen.queryAllByText(note)).toHaveLength(0))
  })
})

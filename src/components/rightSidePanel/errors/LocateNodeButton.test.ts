import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import LocateNodeButton from '@/components/rightSidePanel/errors/LocateNodeButton.vue'

describe('LocateNodeButton', () => {
  it('exposes the label as the button aria-label', () => {
    render(LocateNodeButton, { props: { label: 'Locate node on canvas' } })

    expect(
      screen.getByRole('button', { name: 'Locate node on canvas' })
    ).toHaveAttribute('aria-label', 'Locate node on canvas')
  })

  it('emits locate when clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = render(LocateNodeButton, {
      props: { label: 'Locate node on canvas' }
    })

    await user.click(
      screen.getByRole('button', { name: 'Locate node on canvas' })
    )

    expect(emitted().locate).toHaveLength(1)
  })

  it('emits locate on keyboard activation', async () => {
    const user = userEvent.setup()
    const { emitted } = render(LocateNodeButton, {
      props: { label: 'Locate node on canvas' }
    })

    await user.tab()
    await user.keyboard('{Enter}')

    expect(emitted().locate).toHaveLength(1)
  })

  it('stops click propagation so an ancestor handler does not also fire', async () => {
    const user = userEvent.setup()
    const onAncestorClick = vi.fn()
    render({
      components: { LocateNodeButton },
      setup: () => ({ onAncestorClick }),
      template:
        '<div @click="onAncestorClick"><LocateNodeButton label="Locate node on canvas" /></div>'
    })

    await user.click(
      screen.getByRole('button', { name: 'Locate node on canvas' })
    )

    expect(onAncestorClick).not.toHaveBeenCalled()
  })
})

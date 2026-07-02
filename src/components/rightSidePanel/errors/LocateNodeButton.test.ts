import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import LocateNodeButton from '@/components/rightSidePanel/errors/LocateNodeButton.vue'

describe('LocateNodeButton', () => {
  it('exposes the aria-label as the button accessible name', () => {
    render(LocateNodeButton, { props: { label: 'Locate node on canvas' } })

    expect(
      screen.getByRole('button', { name: 'Locate node on canvas' })
    ).toBeInTheDocument()
  })

  it('emits locate when clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = render(LocateNodeButton, {
      props: { label: 'Locate node on canvas' }
    })

    await user.click(screen.getByRole('button'))

    expect(emitted().locate).toHaveLength(1)
  })

  it('stops click propagation so an ancestor handler does not also fire', async () => {
    const user = userEvent.setup()
    let ancestorClicks = 0
    render(
      {
        components: { LocateNodeButton },
        template:
          '<div @click="onAncestorClick"><LocateNodeButton label="Locate node on canvas" /></div>',
        methods: {
          onAncestorClick() {
            ancestorClicks++
          }
        }
      },
      {}
    )

    await user.click(screen.getByRole('button'))

    expect(ancestorClicks).toBe(0)
  })
})

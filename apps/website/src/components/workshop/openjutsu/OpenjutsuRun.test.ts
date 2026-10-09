import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import OpenjutsuRun from './OpenjutsuRun.vue'

const ready = {
  gate: 'ready' as const,
  canGenerate: true,
  rendering: false,
  priceNote: 'Free · 3 of 5 left today'
}

describe('OpenjutsuRun', () => {
  it('swaps, naming what the run costs and that the sound is kept', async () => {
    const { emitted } = render(OpenjutsuRun, { props: ready })

    await userEvent.click(
      screen.getByRole('button', { name: /Swap character/ })
    )

    expect(screen.getByTestId('openjutsu-price')).toHaveTextContent(
      'Free · 3 of 5 left today'
    )
    expect(
      screen.getByText('The original sound is kept on the result.')
    ).toBeVisible()
    expect(emitted('generate')).toHaveLength(1)
  })

  it.for([
    {
      name: 'an input is missing',
      props: { missing: 'character' as const, canGenerate: false },
      says: 'Add a character image'
    },
    {
      name: 'the quote refuses the run',
      props: {
        canGenerate: false,
        priceNote: 'No free runs left; next one in 5 hours'
      },
      says: 'No free runs left; next one in 5 hours'
    }
  ])('says why it cannot swap when $name', ({ props, says }) => {
    render(OpenjutsuRun, { props: { ...ready, ...props } })

    expect(screen.getByRole('button', { name: says })).toBeDisabled()
  })

  it('becomes Cancel while a take renders, with the panel still open for the next', async () => {
    const { emitted } = render(OpenjutsuRun, {
      props: { ...ready, rendering: true, canGenerate: false }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(
      screen.getByText('Swapping. You can set up the next take meanwhile.')
    ).toBeVisible()
    expect(emitted('cancel')).toHaveLength(1)
  })
})

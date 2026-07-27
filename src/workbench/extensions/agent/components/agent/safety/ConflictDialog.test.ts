import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import ConflictDialog from './ConflictDialog.vue'

const t = i18n.global.t

function renderOpen() {
  return render(ConflictDialog, {
    props: { open: true },
    global: { plugins: [i18n] }
  })
}

describe('ConflictDialog', () => {
  it('resolves with cancel when dismissed by Escape', async () => {
    const user = userEvent.setup()
    const { emitted } = renderOpen()

    await user.keyboard('{Escape}')

    expect(emitted().resolve).toEqual([['cancel']])
  })

  it('resolves with cancel on Escape even once a global keybinding has preventDefaulted it', async () => {
    // ComfyUI's keybindingService preventDefaults Escape on window before reka
    // sees it, which suppresses reka's own dismiss. Registering first puts this
    // listener ahead of reka's, reproducing that order.
    function swallowEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') event.preventDefault()
    }
    window.addEventListener('keydown', swallowEscape)
    try {
      const user = userEvent.setup()
      const { emitted } = renderOpen()

      await user.keyboard('{Escape}')

      expect(emitted().resolve).toEqual([['cancel']])
    } finally {
      window.removeEventListener('keydown', swallowEscape)
    }
  })

  it('resolves once with the accepted choice', async () => {
    const user = userEvent.setup()
    const { emitted } = renderOpen()

    await user.click(
      await screen.findByRole('button', { name: t('agent.acceptAgent') })
    )

    expect(emitted().resolve).toEqual([['agent']])
  })

  it('resolves once with cancel from the close button', async () => {
    const user = userEvent.setup()
    const { emitted } = renderOpen()

    await user.click(await screen.findByRole('button', { name: t('g.close') }))

    expect(emitted().resolve).toEqual([['cancel']])
  })
})

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import UnsavedWorkDialogContent from './UnsavedWorkDialogContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderDialog(hint?: string) {
  const user = userEvent.setup()
  const onResult = vi.fn()
  render(UnsavedWorkDialogContent, {
    props: {
      title: 'Save your workflows before switching?',
      message: 'Switching to Studio reloads the tab.',
      itemList: ['workflows/portrait.json', 'workflows/upscale.json'],
      hint,
      denyLabel: 'Switch without saving',
      confirmLabel: 'Save and switch',
      onResult
    },
    global: { plugins: [i18n] }
  })
  return { user, onResult }
}

describe('UnsavedWorkDialogContent', () => {
  it('names each unsaved workflow and the hint', () => {
    renderDialog('Your open tabs come back after the reload either way.')

    expect(
      screen.getByText('Save your workflows before switching?')
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      ['workflows/portrait.json', 'workflows/upscale.json']
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your open tabs come back after the reload either way.'
    )
  })

  it('leaves the hint out when there is none', () => {
    renderDialog()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('makes Save and switch the primary action and the one the dialog focuses', () => {
    renderDialog()

    const save = screen.getByRole('button', { name: 'Save and switch' })
    expect(save).toHaveClass('bg-foreground')
    expect(
      screen.getByRole('button', { name: 'Switch without saving' })
    ).toHaveClass('bg-secondary')
    expect(save).toHaveAttribute('autofocus')
  })

  it.for([
    { name: 'Save and switch', result: true },
    { name: 'Switch without saving', result: false },
    { name: 'Close', result: null }
  ])('answers $result on $name', async ({ name, result }) => {
    const { user, onResult } = renderDialog()

    await user.click(screen.getByRole('button', { name }))

    expect(onResult).toHaveBeenCalledExactlyOnceWith(result)
  })
})

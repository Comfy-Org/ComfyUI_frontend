import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, h, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import CinematicColors from './CinematicColors.vue'

function renderColors(start: readonly string[] = [], startMain?: number) {
  const colors = ref<readonly string[]>(start)
  const main = ref<number | undefined>(startMain)
  render(
    defineComponent({
      setup: () => () =>
        h(CinematicColors, {
          modelValue: colors.value,
          'onUpdate:modelValue': (value: readonly string[]) => {
            colors.value = value
          },
          main: main.value,
          'onUpdate:main': (value: number | undefined) => {
            main.value = value
          }
        })
    })
  )
  return { colors, main, user: userEvent.setup() }
}

describe('CinematicColors', () => {
  it('adds a color after the last one', async () => {
    const { colors, user } = renderColors(['#aa0000'])
    await user.click(screen.getByRole('button', { name: 'Add a color' }))
    expect(colors.value).toEqual(['#aa0000', '#aa0000'])
  })

  it('marks one color as main and keeps it pointed right after a removal', async () => {
    const { colors, main, user } = renderColors([
      '#aa0000',
      '#00aa00',
      '#0000aa'
    ])
    await user.click(screen.getByRole('button', { name: 'Make main color: 3' }))
    expect(main.value).toBe(2)
    await user.click(screen.getByRole('button', { name: 'Remove color 1' }))
    expect(colors.value).toEqual(['#00aa00', '#0000aa'])
    expect(main.value).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Remove color 2' }))
    expect(main.value).toBeUndefined()
  })

  it('edits the chosen swatch from the hex field', async () => {
    const { colors, user } = renderColors(['#aa0000', '#00aa00'])
    await user.click(screen.getByRole('button', { name: 'Color 2: #00aa00' }))
    const hex = screen.getByRole('textbox', { name: 'Hex color' })
    await user.clear(hex)
    await user.type(hex, '3b1b6e{Enter}')
    expect(colors.value).toEqual(['#aa0000', '#3b1b6e'])
  })

  it('keeps the color when the hex field holds no color', async () => {
    const { colors, user } = renderColors(['#aa0000'])
    const hex = screen.getByRole('textbox', { name: 'Hex color' })
    await user.clear(hex)
    await user.type(hex, 'nope{Enter}')
    expect(colors.value).toEqual(['#aa0000'])
    expect(hex).toHaveValue('#aa0000')
  })

  it('clears every color', async () => {
    const { colors, main, user } = renderColors(['#aa0000'], 0)
    await user.click(screen.getByRole('button', { name: 'Clear colors' }))
    expect(colors.value).toEqual([])
    expect(main.value).toBeUndefined()
  })
})

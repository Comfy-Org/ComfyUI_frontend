import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, h, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sampleImageColors } from '../../../lib/workshop/cinematic-studio/colors'
import CinematicColors from './CinematicColors.vue'

vi.mock(import('../../../lib/workshop/cinematic-studio/colors'), {
  spy: true
})

beforeEach(() => {
  vi.mocked(sampleImageColors).mockImplementation(async (file: File) => {
    if (file.name === 'bad.png') throw new Error('Unsupported image')
    return ['#102030', '#405060']
  })
})

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

  it('fills the palette from an image without sending it anywhere', async () => {
    const { colors, main, user } = renderColors(['#aa0000'], 0)
    await user.upload(
      screen.getByTestId('cinematic-colors-sample'),
      new File(['x'], 'harbor.png', { type: 'image/png' })
    )
    expect(colors.value).toEqual(['#102030', '#405060'])
    expect(main.value).toBeUndefined()
  })

  it('says so when an image cannot be read', async () => {
    const { colors, user } = renderColors(['#aa0000'])
    await user.upload(
      screen.getByTestId('cinematic-colors-sample'),
      new File(['x'], 'bad.png', { type: 'image/png' })
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      "Couldn't read colors from that image."
    )
    expect(colors.value).toEqual(['#aa0000'])
  })

  it('clears every color', async () => {
    const { colors, main, user } = renderColors(['#aa0000'], 0)
    await user.click(screen.getByRole('button', { name: 'Clear colors' }))
    expect(colors.value).toEqual([])
    expect(main.value).toBeUndefined()
  })
})

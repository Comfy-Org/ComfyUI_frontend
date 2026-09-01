/* eslint-disable testing-library/no-node-access, testing-library/no-container, testing-library/prefer-user-event */
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import WidgetColors from './WidgetColors.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { palette: { swatchTitle: 'Edit', addColor: 'Add' } } }
})

function renderWidget(modelValue: string[], widget?: { name: string }) {
  return render(WidgetColors, {
    props: { modelValue, widget },
    global: { plugins: [i18n] }
  })
}

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

describe('WidgetColors', () => {
  it('renders the palette swatch row for each color', () => {
    renderWidget(['#ff0000', '#00ff00'])
    const root = screen.getByTestId('colors')
    expect(root.querySelectorAll('[data-index]')).toHaveLength(2)
  })

  it('shows the widget name as an inline label', () => {
    renderWidget(['#ff0000'], { name: 'color_palette' })
    expect(screen.getByText('color_palette')).toBeInTheDocument()
  })

  it('emits an updated palette when a color is added', async () => {
    const { emitted } = renderWidget([])
    await userEvent.click(screen.getByRole('button'))
    const calls = emitted()['update:modelValue'] as unknown[][]
    expect(calls[calls.length - 1][0]).toEqual(['#ffffff'])
  })

  it('does not stop swatch pointer moves from reaching document drag handlers', async () => {
    const { container } = renderWidget(['#ff0000'])
    const onDocMove = vi.fn()
    document.addEventListener('pointermove', onDocMove)
    cleanups.push(() => document.removeEventListener('pointermove', onDocMove))
    await fireEvent.pointerMove(container.querySelector('[data-index="0"]')!)
    expect(onDocMove).toHaveBeenCalled()
  })
})

/* eslint-disable testing-library/no-container, testing-library/no-node-access, testing-library/prefer-user-event */
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import PaletteSwatchRow from './PaletteSwatchRow.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { palette: { swatchTitle: 'Edit', addColor: 'Add' } } }
})

function renderRow(modelValue: string[], max = 5) {
  return render(PaletteSwatchRow, {
    props: { modelValue, max },
    global: { plugins: [i18n] }
  })
}

const lastEmit = (emitted: () => Record<string, unknown[][]>) => {
  const calls = emitted()['update:modelValue']
  return calls[calls.length - 1][0]
}

describe('PaletteSwatchRow', () => {
  it('renders one swatch per color', () => {
    const { container } = renderRow(['#ff0000', '#00ff00'])
    expect(container.querySelectorAll('[data-index]')).toHaveLength(2)
  })

  it('appends a color when the add button is clicked', async () => {
    const { emitted } = renderRow(['#ff0000'])
    await userEvent.click(screen.getByRole('button'))
    expect(lastEmit(emitted)).toEqual(['#ff0000', '#ffffff'])
  })

  it('removes a color on right click', async () => {
    const { container, emitted } = renderRow(['#ff0000', '#00ff00'])
    await fireEvent.contextMenu(container.querySelector('[data-index="0"]')!)
    expect(lastEmit(emitted)).toEqual(['#00ff00'])
  })

  it('hides the add button once the max is reached', () => {
    renderRow(['#a', '#b'], 2)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('writes a picked color back through the hidden color input', async () => {
    const { container, emitted } = renderRow(['#ff0000', '#00ff00'])
    await fireEvent.click(container.querySelector('[data-index="1"]')!)
    const input = container.querySelector(
      'input[type="color"]'
    ) as HTMLInputElement
    input.value = '#0000ff'
    await fireEvent.input(input)
    expect(lastEmit(emitted)).toEqual(['#ff0000', '#0000ff'])
  })

  it('starts a drag on pointer down without emitting', async () => {
    const { container, emitted } = renderRow(['#ff0000', '#00ff00'])
    await fireEvent.pointerDown(container.querySelector('[data-index="0"]')!, {
      button: 0,
      clientX: 5,
      clientY: 5
    })
    expect(emitted()['update:modelValue']).toBeUndefined()
  })
})

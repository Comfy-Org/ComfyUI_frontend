import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import WidgetHistoryButtons from './WidgetHistoryButtons.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { widgetHistory: { undo: 'Undo', redo: 'Redo' } } }
})

function renderButtons(props: { canUndo: boolean; canRedo: boolean }) {
  return render(WidgetHistoryButtons, {
    props,
    global: { plugins: [i18n] }
  })
}

describe('WidgetHistoryButtons', () => {
  it.for([
    { canUndo: true, canRedo: false },
    { canUndo: false, canRedo: true }
  ])(
    'enables only the available actions (undo=$canUndo, redo=$canRedo)',
    ({ canUndo, canRedo }) => {
      renderButtons({ canUndo, canRedo })

      expect(
        screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')
      ).toBe(!canUndo)
      expect(
        screen.getByRole('button', { name: 'Redo' }).hasAttribute('disabled')
      ).toBe(!canRedo)
    }
  )

  it.for([
    { action: 'undo', label: 'Undo' },
    { action: 'redo', label: 'Redo' }
  ])('emits $action when clicked', async ({ action, label }) => {
    const { emitted } = renderButtons({ canUndo: true, canRedo: true })

    await userEvent.setup().click(screen.getByRole('button', { name: label }))

    expect(emitted(action)).toHaveLength(1)
  })
})

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetSetRandomInt from './WidgetSetRandomInt.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { randomizeSeed: 'Randomize Seed' } } }
})

function renderComponent(options: Record<string, number>) {
  const widget = {
    name: 'seed',
    type: 'INT',
    value: 0,
    options
  } as unknown as SimplifiedWidget<number>

  return render(WidgetSetRandomInt, {
    props: { widget, modelValue: 0 },
    global: {
      plugins: [i18n],
      stubs: { WidgetInputNumber: true }
    }
  })
}

describe('WidgetSetRandomInt', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits a randomized value from the widget range when clicked', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { emitted } = renderComponent({ min: 10, max: 20, step2: 2 })

    await userEvent.click(
      screen.getByRole('button', { name: 'Randomize Seed' })
    )

    expect(emitted()['update:modelValue']).toEqual([[14]])
  })
})

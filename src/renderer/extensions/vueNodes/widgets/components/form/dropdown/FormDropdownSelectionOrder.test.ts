import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import FormDropdownSelectionOrder from './FormDropdownSelectionOrder.vue'
import type { FormDropdownItem } from './types'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const items: FormDropdownItem[] = ['a.png', 'b.png', 'c.png'].map((name) => ({
  id: name,
  name
}))

function renderOrder() {
  const onReorder = vi.fn()
  render(FormDropdownSelectionOrder, {
    props: { items, onReorder },
    global: { plugins: [i18n] }
  })
  return { onReorder, entries: screen.getAllByRole('listitem') }
}

describe('FormDropdownSelectionOrder', () => {
  it('numbers the entries in selection order', () => {
    const { entries } = renderOrder()

    expect(entries.map((entry) => entry.getAttribute('aria-label'))).toEqual([
      '1. a.png',
      '2. b.png',
      '3. c.png'
    ])
  })

  it.for([
    { key: '{ArrowRight}', index: 0, expected: ['b.png', 'a.png', 'c.png'] },
    { key: '{ArrowLeft}', index: 2, expected: ['a.png', 'c.png', 'b.png'] },
    { key: '{ArrowLeft}', index: 0, expected: undefined },
    { key: '{ArrowRight}', index: 2, expected: undefined }
  ])('moves entry $index with $key', async ({ key, index, expected }) => {
    const user = userEvent.setup()
    const { onReorder, entries } = renderOrder()
    entries[index].focus()

    await user.keyboard(key)

    expect(onReorder.mock.lastCall).toEqual(expected && [expected])
  })

  it('moves a dragged entry to the slot it is dropped on', async () => {
    const { onReorder, entries } = renderOrder()

    await fireEvent.dragStart(entries[2])
    await fireEvent.drop(entries[0])

    expect(onReorder).toHaveBeenCalledWith(['c.png', 'a.png', 'b.png'])
  })
})

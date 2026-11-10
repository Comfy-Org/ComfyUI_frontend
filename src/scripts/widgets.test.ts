import { afterEach, expect, test } from 'vitest'
import { nextTick } from 'vue'

import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import { createNumberInput } from '@/scripts/widgets'
import type { NumberInputInteraction } from '@/types/numberInput'

let control: ReturnType<typeof createNumberInput> | undefined
afterEach(() => {
  control?.destroy()
  control?.element.remove()
})

test('extension policy commits once and preserves drafts across presentation updates', async () => {
  const user = userEvent.setup()
  const changes: number[] = []
  control = createNumberInput({
    name: 'Width',
    value: 13,
    onInteraction(interaction) {
      if (interaction.kind !== 'text') return
      const value = Math.round(Number(interaction.value) / 8) * 8
      changes.push(value)
      control?.update({ value, displayValue: String(value) })
    }
  })
  document.body.append(control.element)
  control.edit()
  await nextTick()
  await user.clear(screen.getByRole('textbox', { name: 'Width' }))
  await user.type(screen.getByRole('textbox', { name: 'Width' }), '-')
  control.update({
    value: 19,
    displayValue: '19',
    unit: 'px',
    annotation: 'source'
  })
  await nextTick()
  expect(screen.getByRole('textbox', { name: 'Width' })).toHaveValue('-')
  expect(screen.getByText('source')).toBeVisible()
  await user.keyboard('{Escape}')
  expect(screen.getByRole('textbox', { name: 'Width' })).toHaveValue('19')
  expect(changes).toEqual([])
  control.edit()
  await nextTick()
  await user.clear(screen.getByRole('textbox', { name: 'Width' }))
  await user.type(screen.getByRole('textbox', { name: 'Width' }), '13{Enter}')
  expect(screen.getByRole('textbox', { name: 'Width' })).not.toHaveFocus()
  await user.tab()
  expect(changes).toEqual([16])
  expect(screen.getByRole('textbox', { name: 'Width' })).toHaveValue('16')
  expect(screen.getByRole('textbox', { name: 'Width' })).not.toHaveProperty(
    'readOnly',
    true
  )
  await user.clear(screen.getByRole('textbox', { name: 'Width' }))
  await user.type(screen.getByRole('textbox', { name: 'Width' }), '21{Enter}')
  expect(changes).toEqual([16, 24])
})

test('buttons use extension policy and remain usable after removal and remount', async () => {
  const user = userEvent.setup()
  let value = 0
  control = createNumberInput({
    name: 'Width',
    value,
    onInteraction(interaction) {
      if (interaction.kind !== 'step') return
      value += interaction.delta * 8
      control?.update({ value })
    }
  })
  document.body.append(control.element)
  await user.click(screen.getByRole('button', { name: 'Increment' }))
  expect(screen.getByRole('textbox', { name: 'Width' })).toHaveValue('8')
  control.destroy()
  control.mount()
  await user.click(screen.getByRole('button', { name: 'Decrement' }))
  expect(screen.getByRole('textbox', { name: 'Width' })).toHaveValue('0')
  control.update({ disabled: true })
  await nextTick()
  expect(screen.getByRole('button', { name: 'Increment' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Decrement' })).toBeDisabled()
})

test.for([
  { distance: 0.5, readonly: false, interactions: [] },
  { distance: 1, readonly: true, interactions: [{ kind: 'drag', delta: 1 }] },
  { distance: 3, readonly: true, interactions: [{ kind: 'drag', delta: 3 }] }
])(
  'pointer movement $distance preserves click and drag behavior',
  async (row) => {
    const user = userEvent.setup()
    const interactions: NumberInputInteraction[] = []
    control = createNumberInput({
      name: 'Width',
      value: 13,
      onInteraction: (interaction) => interactions.push(interaction)
    })
    document.body.append(control.element)
    await nextTick()
    const target = screen.getByTestId('number-input-scrub')
    target.setPointerCapture = () => {}
    await user.pointer([
      { target, keys: '[MouseLeft>]', coords: { clientX: 100, clientY: 20 } },
      { coords: { clientX: 100 + row.distance, clientY: 20 } },
      { keys: '[/MouseLeft]' }
    ])
    expect(screen.getByRole('textbox', { name: 'Width' })).toHaveProperty(
      'readOnly',
      row.readonly
    )
    expect(interactions).toEqual(row.interactions)
  }
)

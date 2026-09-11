// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, ref } from 'vue'
import { expect, it } from 'vitest'

import { useTablist } from './useTablist'

it('supports Home, End, and wrapping arrows with matching focus and selection', async () => {
  const user = userEvent.setup()
  render(
    defineComponent({
      setup() {
        const items = ['One', 'Two', 'Three']
        const active = ref('One')
        return { items, active, ...useTablist(() => items, active) }
      },
      template:
        '<div role="tablist" @keydown="onKeydown"><button v-for="item in items" :key="item" role="tab" :aria-selected="active === item" :tabindex="active === item ? 0 : -1">{{ item }}</button></div>'
    })
  )
  await user.tab()
  await user.keyboard('{End}')
  expect(screen.getByRole('tab', { selected: true })).toBe(
    screen.getByRole('tab', { name: 'Three' })
  )
  expect(screen.getByRole('tab', { name: 'Three' }).matches(':focus')).toBe(
    true
  )
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { selected: true })).toBe(
    screen.getByRole('tab', { name: 'One' })
  )
  await user.keyboard('{ArrowRight}{Home}')
  expect(screen.getByRole('tab', { selected: true })).toBe(
    screen.getByRole('tab', { name: 'One' })
  )
  await user.keyboard('{ArrowLeft}')
  expect(screen.getByRole('tab', { name: 'Three' }).matches(':focus')).toBe(
    true
  )
})

it('leaves the selection unchanged for navigation keys on an empty tablist', () => {
  const active = ref('unchanged')
  const { onKeydown } = useTablist(() => [], active)

  for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight'])
    onKeydown(new KeyboardEvent('keydown', { key }))

  expect(active.value).toBe('unchanged')
})

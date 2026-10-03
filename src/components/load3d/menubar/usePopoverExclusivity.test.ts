import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { usePopoverExclusivity } from '@/components/load3d/menubar/usePopoverExclusivity'

const Toggle = defineComponent({
  props: { popoverId: { type: String, required: true } },
  setup(props) {
    const open = usePopoverExclusivity()(props.popoverId)
    return () =>
      h('div', [
        h(
          'span',
          { 'data-testid': `${props.popoverId}-state` },
          open.value ? 'open' : 'closed'
        ),
        h(
          'button',
          { onClick: () => (open.value = true) },
          `open ${props.popoverId}`
        ),
        h(
          'button',
          { onClick: () => (open.value = false) },
          `close ${props.popoverId}`
        )
      ])
  }
})

const Menubar = defineComponent({
  setup() {
    usePopoverExclusivity()
    return () => [h(Toggle, { popoverId: 'a' }), h(Toggle, { popoverId: 'b' })]
  }
})

function renderMenubar() {
  render(Menubar)
  return userEvent.setup()
}

describe('usePopoverExclusivity', () => {
  it('keeps popovers across components mutually exclusive', async () => {
    const user = renderMenubar()

    await user.click(screen.getByRole('button', { name: 'open a' }))
    expect(screen.getByTestId('a-state')).toHaveTextContent('open')

    await user.click(screen.getByRole('button', { name: 'open b' }))
    expect(screen.getByTestId('b-state')).toHaveTextContent('open')
    expect(screen.getByTestId('a-state')).toHaveTextContent('closed')
  })

  it('ignores a close from a popover that is not the open one', async () => {
    const user = renderMenubar()

    await user.click(screen.getByRole('button', { name: 'open a' }))
    await user.click(screen.getByRole('button', { name: 'close b' }))

    expect(screen.getByTestId('a-state')).toHaveTextContent('open')
  })
})

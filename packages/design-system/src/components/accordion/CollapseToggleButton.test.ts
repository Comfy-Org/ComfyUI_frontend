import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import CollapseToggleButton from './CollapseToggleButton.vue'

function renderToggle(collapsed: boolean, show = true) {
  const isAllCollapsed = ref(collapsed)
  render(CollapseToggleButton, {
    props: {
      show,
      expandLabel: 'Expand all',
      collapseLabel: 'Collapse all',
      modelValue: isAllCollapsed.value,
      'onUpdate:modelValue': (value: boolean) => {
        isAllCollapsed.value = value
      }
    }
  })
  return isAllCollapsed
}

describe('CollapseToggleButton', () => {
  it('collapses every section when they are expanded', async () => {
    const isAllCollapsed = renderToggle(false)

    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }))

    expect(isAllCollapsed.value).toBe(true)
  })

  it('expands every section when they are collapsed', async () => {
    const isAllCollapsed = renderToggle(true)

    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))

    expect(isAllCollapsed.value).toBe(false)
  })

  it('renders nothing while hidden', () => {
    renderToggle(false, false)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

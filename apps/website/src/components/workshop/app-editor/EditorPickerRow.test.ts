import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import EditorPickerRow from './EditorPickerRow.vue'

function renderRow(props: {
  expanded?: boolean
  popup?: boolean
  labelAbove?: boolean
}) {
  return render(EditorPickerRow, {
    props: { label: 'Scene', value: 'Red carpet', expanded: false, ...props },
    slots: { default: '<img alt="" src="/carpet.jpg" />' }
  })
}

describe('EditorPickerRow', () => {
  it('names the current option and asks to open its picker', async () => {
    const { emitted } = renderRow({ expanded: true })

    const row = screen.getByRole('button', { name: 'Scene: Red carpet' })
    expect(row).toHaveAttribute('aria-haspopup', 'dialog')
    expect(row).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(row)
    expect(emitted('toggle')).toHaveLength(1)
  })

  it('unfolds in place without a popup', () => {
    renderRow({ popup: false })

    const row = screen.getByRole('button', { name: 'Scene: Red carpet' })
    expect(row).not.toHaveAttribute('aria-haspopup')
    expect(row).toHaveAttribute('aria-expanded', 'false')
  })

  it.for([
    { labelAbove: false, outside: false },
    { labelAbove: true, outside: true }
  ])(
    'puts its label inside the row unless set above (labelAbove: $labelAbove)',
    ({ labelAbove, outside }) => {
      renderRow({ labelAbove })

      const row = screen.getByRole('button', { name: 'Scene: Red carpet' })
      const label = screen.getByText('Scene')
      expect(row.contains(label)).toBe(!outside)
    }
  )
})

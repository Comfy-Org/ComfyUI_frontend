import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CopyTextButton from './CopyTextButton.vue'

function renderIcon(iconClass?: string) {
  render(CopyTextButton, {
    props: {
      value: 'req-1',
      label: 'Copy request ID',
      copiedLabel: 'Copied',
      iconClass
    }
  })
  return screen.getByTestId('copy-text-icon')
}

describe('CopyTextButton', () => {
  it('sizes its icon for the button it is, when nobody asks for anything else', () => {
    expect(renderIcon()).toHaveClass('size-5')
  })

  it("takes the caller's size in place of its own, not beside it", () => {
    const icon = renderIcon('size-3.5')
    expect(icon).toHaveClass('size-3.5')
    expect(icon).not.toHaveClass('size-5')
  })
})

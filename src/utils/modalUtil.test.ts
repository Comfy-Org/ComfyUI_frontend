import { describe, expect, it } from 'vitest'

import { isModalOpen } from './modalUtil'

function disableCheckVisibility(element: Element): void {
  Object.defineProperty(element, 'checkVisibility', { value: undefined })
}

describe('isModalOpen', () => {
  it('detects a visible dialog when checkVisibility is unavailable', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>'
    const dialog = document.querySelector('[role="dialog"]')!
    disableCheckVisibility(dialog)

    expect(isModalOpen(0)).toBe(true)
  })

  it('ignores a dialog hidden by an ancestor when checkVisibility is unavailable', () => {
    document.body.innerHTML = `
      <div style="display: none">
        <div role="dialog" aria-modal="true"></div>
      </div>
    `
    const dialog = document.querySelector('[role="dialog"]')!
    disableCheckVisibility(dialog)

    expect(isModalOpen(0)).toBe(false)
  })
})

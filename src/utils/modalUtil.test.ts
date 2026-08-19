import { afterEach, describe, expect, it } from 'vitest'

import { isModalOpen } from '@/utils/modalUtil'

const NO_MANAGED_DIALOGS = 0

function render(html: string): void {
  document.body.insertAdjacentHTML('beforeend', html)
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('isModalOpen', () => {
  it('is false on a bare page', () => {
    expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(false)
  })

  it('is true while the app has a managed dialog on the stack', () => {
    expect(isModalOpen(1)).toBe(true)
  })

  describe('overlays that block the page', () => {
    it('counts an ARIA modal', () => {
      render('<div role="dialog" aria-modal="true"></div>')

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(true)
    })

    it('counts an open Reka dialog', () => {
      render('<div role="dialog" data-state="open"></div>')

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(true)
    })

    it('counts an open native dialog', () => {
      render('<dialog open></dialog>')

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(true)
    })

    it('counts a visible legacy ComfyDialog', () => {
      render('<div class="comfy-modal" style="display: flex"></div>')

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(true)
    })
  })

  describe('overlays that do not block the page', () => {
    it('ignores a hidden legacy ComfyDialog', () => {
      render('<div class="comfy-modal" style="display: none"></div>')

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(false)
    })

    it('ignores a Reka popover', () => {
      render(`
        <div data-reka-popper-content-wrapper>
          <div role="dialog" data-state="open"></div>
        </div>
      `)

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(false)
    })

    // Regression: hovering a workflow tab renders a PrimeVue Popover, which
    // declares aria-modal="true" despite being a non-blocking hover preview.
    it('ignores a PrimeVue popover that declares itself modal', () => {
      render('<div class="p-popover" role="dialog" aria-modal="true"></div>')

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(false)
    })

    it('ignores content nested inside a popover', () => {
      render(`
        <div class="p-popover">
          <div role="dialog" aria-modal="true"></div>
        </div>
      `)

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(false)
    })
  })

  describe('overlays left in the DOM after closing', () => {
    it('ignores a dialog hidden by its own display', () => {
      render(
        '<div role="dialog" aria-modal="true" style="display: none"></div>'
      )

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(false)
    })

    // Regression: ComfyUI-Manager hides only the mask on close, leaving its
    // aria-modal dialog node in the DOM for the rest of the session.
    it('ignores a dialog hidden by an ancestor mask', () => {
      render(`
        <div class="p-dialog-mask" style="display: none">
          <div role="dialog" aria-modal="true" style="display: flex"></div>
        </div>
      `)

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(false)
    })

    it('still counts a dialog inside a visible mask', () => {
      render(`
        <div class="p-dialog-mask" style="display: flex">
          <div role="dialog" aria-modal="true" style="display: flex"></div>
        </div>
      `)

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(true)
    })

    it('still counts a sibling dialog that is genuinely open', () => {
      render(`
        <div class="p-dialog-mask" style="display: none">
          <div role="dialog" aria-modal="true" style="display: flex"></div>
        </div>
        <div role="dialog" aria-modal="true"></div>
      `)

      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(true)
    })
  })
})

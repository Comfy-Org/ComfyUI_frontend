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

  it('ignores a dialog with hidden visibility when checkVisibility is unavailable', () => {
    document.body.innerHTML = `
      <div role="dialog" aria-modal="true" style="visibility: hidden"></div>
    `
    const dialog = document.querySelector('[role="dialog"]')!
    disableCheckVisibility(dialog)

    expect(isModalOpen(0)).toBe(false)
  })

  it('detects a visible dialog that overrides an ancestor hidden visibility', () => {
    document.body.innerHTML = `
      <div style="visibility: hidden">
        <div role="dialog" aria-modal="true" style="visibility: visible"></div>
      </div>
    `
    const dialog = document.querySelector('[role="dialog"]')!
    disableCheckVisibility(dialog)

    expect(isModalOpen(0)).toBe(true)
  })

  it.for([
    {
      name: 'itself',
      markup:
        '<div role="dialog" aria-modal="true" style="content-visibility: hidden"></div>'
    },
    {
      name: 'an ancestor',
      markup:
        '<div style="content-visibility: hidden"><div role="dialog" aria-modal="true"></div></div>'
    }
  ])('ignores a dialog hidden by content-visibility on $name', ({ markup }) => {
    document.body.innerHTML = markup
    const dialog = document.querySelector('[role="dialog"]')!
    disableCheckVisibility(dialog)

    expect(isModalOpen(0)).toBe(false)
  })

  it('ignores a dialog whose own display is contents', () => {
    document.body.innerHTML = `
      <div role="dialog" aria-modal="true" style="display: contents"></div>
    `
    const dialog = document.querySelector('[role="dialog"]')!
    disableCheckVisibility(dialog)

    expect(isModalOpen(0)).toBe(false)
  })

  it('detects a dialog below a display contents ancestor', () => {
    document.body.innerHTML = `
      <div style="display: contents">
        <div role="dialog" aria-modal="true"></div>
      </div>
    `
    const dialog = document.querySelector('[role="dialog"]')!
    disableCheckVisibility(dialog)

    expect(isModalOpen(0)).toBe(true)
  })

  it('ignores a dialog inside closed details content', () => {
    document.body.innerHTML = `
      <details>
        <summary>Advanced</summary>
        <div role="dialog" aria-modal="true"></div>
      </details>
    `
    const dialog = document.querySelector('[role="dialog"]')!
    disableCheckVisibility(dialog)

    expect(isModalOpen(0)).toBe(false)
  })

  it('detects a dialog inside the summary of closed details', () => {
    document.body.innerHTML = `
      <details>
        <summary><div role="dialog" aria-modal="true"></div></summary>
      </details>
    `
    const dialog = document.querySelector('[role="dialog"]')!
    disableCheckVisibility(dialog)

    expect(isModalOpen(0)).toBe(true)
  })

  it('detects a dialog inside open details content', () => {
    document.body.innerHTML = `
      <details open>
        <summary>Advanced</summary>
        <div role="dialog" aria-modal="true"></div>
      </details>
    `
    const dialog = document.querySelector('[role="dialog"]')!
    disableCheckVisibility(dialog)

    expect(isModalOpen(0)).toBe(true)
  })
})

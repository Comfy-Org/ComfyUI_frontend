import { describe, expect, it } from 'vitest'

import {
  describeElement,
  findElement,
  isOwnElement,
  meaningfulAncestor
} from './pageElements'

const WINDOW = { width: 1280, height: 800 }

function page(markup: string): HTMLElement {
  document.body.innerHTML = markup
  return document.body
}

function find(selector: string): Element {
  const element = document.querySelector(selector)
  if (!element) throw new Error(`No element matches ${selector}`)
  return element
}

describe('meaningfulAncestor', () => {
  it('E-01: picks the button, not the icon inside it or the wrapper around it', () => {
    page(
      '<div class="wrapper"><button aria-label="Run"><i class="icon"></i></button></div>'
    )

    expect(meaningfulAncestor(find('.icon'), WINDOW)).toBe(find('button'))
  })

  it('E-01: picks a menu item inside an open menu', () => {
    page(
      '<div role="menu" aria-label="File"><div role="menuitem"><span>Save As</span></div></div>'
    )

    expect(meaningfulAncestor(find('span'), WINDOW)).toBe(
      find('[role="menuitem"]')
    )
  })

  it('E-01: falls back to the nearest thing with a name or a test id', () => {
    page('<div data-testid="queue-status"><p><em>3 running</em></p></div>')

    expect(meaningfulAncestor(find('em'), WINDOW)).toBe(
      find('[data-testid="queue-status"]')
    )
  })

  it('E-01: picks nothing for a plain wrapper', () => {
    page('<div><div><span class="plain">text</span></div></div>')

    expect(meaningfulAncestor(find('.plain'), WINDOW)).toBeNull()
  })

  it('E-01: picks nothing when the only named ancestor covers most of the window', () => {
    page('<main data-testid="app"><span class="plain">text</span></main>')
    const app = find('main')
    app.getBoundingClientRect = () => new DOMRect(0, 0, 1280, 800)

    expect(meaningfulAncestor(find('.plain'), WINDOW)).toBeNull()
  })
})

describe('describeElement', () => {
  it('E-02: labels an element by its accessible name, with its role, surroundings and test id', () => {
    page(
      '<div role="toolbar" aria-label="Actions"><button aria-label="Run" data-testid="queue-button">▶</button></div>'
    )

    expect(describeElement(find('button'))).toEqual({
      label: 'Run',
      role: 'button',
      context: 'toolbar "Actions"',
      testId: 'queue-button'
    })
  })

  it('E-02: falls back to the visible text, cut short, when there is no accessible name', () => {
    page(
      `<div role="menu"><div role="menuitem">  Save   the workflow under a different name and keep the original as it is  </div></div>`
    )

    expect(describeElement(find('[role="menuitem"]'))).toEqual({
      label: 'Save the workflow under a different name and keep the origin…',
      role: 'menuitem',
      context: 'menu',
      testId: null
    })
  })
})

describe('findElement', () => {
  it('E-03: finds the same element again after the page redrew it', () => {
    page('<div role="menu"><div role="menuitem">Save As</div></div>')
    const description = describeElement(find('[role="menuitem"]'))
    page(
      '<div role="menu"><div role="menuitem">Open</div><div role="menuitem">Save As</div></div>'
    )

    expect(findElement(description)?.textContent).toBe('Save As')
  })

  it('E-03: finds nothing while the element is not on the page', () => {
    page('<div role="menu"><div role="menuitem">Save As</div></div>')
    const description = describeElement(find('[role="menuitem"]'))
    page('<button>Other</button>')

    expect(findElement(description)).toBeNull()
  })

  it('E-01: never finds or picks the layer’s own elements', () => {
    page('<div data-point-at-it-layer><button>Send 1</button></div>')
    const own = find('button')

    expect(isOwnElement(own)).toBe(true)
    expect(findElement(describeElement(own))).toBeNull()
  })
})

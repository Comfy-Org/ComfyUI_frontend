import { afterEach, describe, expect, it, vi } from 'vitest'

import { ComfyDialog } from './dialog'

const mocks = vi.hoisted(() => ({
  $el: (
    selector: string,
    propsOrChildren?: Record<string, unknown> | Node[],
    maybeChildren?: Node[]
  ) => {
    const [tag, ...classes] = selector.split('.')
    const element = document.createElement(tag || 'div')
    element.classList.add(...classes.filter(Boolean))
    const children = Array.isArray(propsOrChildren)
      ? propsOrChildren
      : maybeChildren

    if (propsOrChildren && !Array.isArray(propsOrChildren)) {
      for (const [key, value] of Object.entries(propsOrChildren)) {
        if (key === 'parent' && value instanceof Node) {
          value.appendChild(element)
        } else if (key === '$' && typeof value === 'function') {
          value(element)
        } else {
          Reflect.set(element, key, value)
        }
      }
    }

    element.append(...(children ?? []))
    return element
  }
}))

vi.mock('../ui', () => ({
  $el: mocks.$el
}))

describe('ComfyDialog', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('shows string and element content and closes through the default button', () => {
    const dialog = new ComfyDialog()

    dialog.show('<strong>Hello</strong>')

    expect(dialog.element.style.display).toBe('flex')
    expect(dialog.textElement.innerHTML).toBe('<strong>Hello</strong>')

    dialog.element.querySelector('button')?.click()
    expect(dialog.element.style.display).toBe('none')

    const first = document.createElement('span')
    const second = document.createElement('em')
    dialog.show([first, second])

    expect([...dialog.textElement.children]).toEqual([first, second])
  })

  it('uses supplied custom buttons', () => {
    const button = document.createElement('button')
    const dialog = new ComfyDialog('section', [button])

    expect(dialog.element.tagName).toBe('SECTION')
    expect(dialog.element.querySelector('button')).toBe(button)
  })
})

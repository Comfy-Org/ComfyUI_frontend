import { afterEach, describe, expect, it, vi } from 'vitest'

import { toggleSwitch } from './toggleSwitch'

const mocks = vi.hoisted(() => ({
  $el: (
    selector: string,
    propsOrChildren?: Record<string, unknown> | Node[] | Node,
    maybeChildren?: Node[] | Node
  ) => {
    const [tag, ...classes] = selector.split('.')
    const element = document.createElement(tag || 'div')
    element.classList.add(...classes.filter(Boolean))
    const children = Array.isArray(propsOrChildren)
      ? propsOrChildren
      : propsOrChildren instanceof Node
        ? [propsOrChildren]
        : Array.isArray(maybeChildren)
          ? maybeChildren
          : maybeChildren instanceof Node
            ? [maybeChildren]
            : []

    if (
      propsOrChildren &&
      !(propsOrChildren instanceof Node) &&
      !Array.isArray(propsOrChildren)
    ) {
      for (const [key, value] of Object.entries(propsOrChildren)) {
        Reflect.set(element, key, value)
      }
    }

    element.append(...children)
    return element
  }
}))

vi.mock('../ui', () => ({
  $el: mocks.$el
}))

describe('toggleSwitch', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('selects the first item when none is preselected', () => {
    const onChange = vi.fn()
    const container = toggleSwitch('mode', ['first', 'second'], { onChange })
    const labels = [...container.querySelectorAll('label')]
    const inputs = [...container.querySelectorAll('input')]

    expect(labels[0].classList.contains('comfy-toggle-selected')).toBe(true)
    expect((inputs[0] as HTMLInputElement).checked).toBe(true)
    expect(onChange).toHaveBeenCalledWith({
      item: 'first',
      prev: undefined
    })
  })

  it('moves selection and reports the previous item', () => {
    const onChange = vi.fn()
    const container = toggleSwitch(
      'mode',
      [
        { text: 'first', tooltip: 'First option' },
        { text: 'second', value: '2' }
      ],
      { onChange }
    )
    const labels = [...container.querySelectorAll('label')]
    const secondInput = labels[1].querySelector('input') as HTMLInputElement

    secondInput.onchange?.(new Event('change'))

    expect(labels[0].classList.contains('comfy-toggle-selected')).toBe(false)
    expect(labels[1].classList.contains('comfy-toggle-selected')).toBe(true)
    expect(labels[0].title).toBe('First option')
    expect(secondInput.value).toBe('2')
    expect(onChange).toHaveBeenLastCalledWith({
      item: { text: 'second', value: '2' },
      prev: { text: 'first', tooltip: 'First option', value: 'first' }
    })
  })
})

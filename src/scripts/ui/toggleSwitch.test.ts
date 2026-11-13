import { afterEach, describe, expect, it, vi } from 'vitest'

import { toggleSwitch } from './toggleSwitch'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/scripts/api'))

function readState(container: HTMLElement) {
  const labels = [...container.querySelectorAll('label')]
  return {
    selected: labels.map((label) =>
      label.classList.contains('comfy-toggle-selected')
    ),
    checked: labels.map(
      (label) => label.querySelector('input')?.checked ?? false
    )
  }
}

describe('toggleSwitch', () => {
  it.for([
    {
      name: 'defaults to the first item',
      items: ['a', 'b', 'c'],
      expected: [true, false, false],
      initialValue: 'a'
    },
    {
      name: 'honours the last selected item',
      items: [
        { text: 'a', selected: true },
        { text: 'b', value: 'B', selected: true },
        { text: 'c' }
      ],
      expected: [false, true, false],
      initialValue: 'B'
    }
  ])('$name', ({ items, expected, initialValue }) => {
    const onChange = vi.fn()
    const container = toggleSwitch('mode', items, { onChange })

    expect(readState(container)).toEqual({
      selected: expected,
      checked: expected
    })
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      item: expect.objectContaining({ value: initialValue }),
      prev: undefined
    })
  })

  it('moves the selection and reports the previous item on change', () => {
    const onChange = vi.fn()
    const container = toggleSwitch('mode', ['instant', 'change'], {
      onChange
    })
    onChange.mockClear()

    const [, secondInput] = container.querySelectorAll('input')
    secondInput.checked = true
    secondInput.dispatchEvent(new Event('change'))

    expect(readState(container)).toEqual({
      selected: [false, true],
      checked: [false, true]
    })
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      item: { text: 'change', value: 'change' },
      prev: { text: 'instant', value: 'instant' }
    })
  })

  describe('on a browser without Array.prototype.findLastIndex', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      'findLastIndex'
    )

    afterEach(() => {
      if (descriptor) {
        Object.defineProperty(Array.prototype, 'findLastIndex', descriptor)
      }
    })

    it('still honours the last selected item', () => {
      Reflect.deleteProperty(Array.prototype, 'findLastIndex')

      const container = toggleSwitch('mode', [
        { text: 'a', selected: true },
        { text: 'b', value: 'B', selected: true },
        { text: 'c' }
      ])

      expect(readState(container)).toEqual({
        selected: [false, true, false],
        checked: [false, true, false]
      })
    })
  })

  it('renders value, tooltip and radio grouping', () => {
    const container = toggleSwitch('mode', [
      { text: 'Fast', value: 'fast', tooltip: 'Go fast' },
      'slow'
    ])

    const [fast, slow] = [...container.querySelectorAll('label')]
    expect(fast.title).toBe('Go fast')
    expect(fast.querySelector('input')?.value).toBe('fast')
    expect(slow.title).toBe('')
    expect(slow.querySelector('input')?.value).toBe('slow')
    expect(
      [...container.querySelectorAll('input')].map((input) => input.name)
    ).toEqual(['mode', 'mode'])
  })
})

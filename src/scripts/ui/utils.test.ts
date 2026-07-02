import { describe, expect, it, vi } from 'vitest'

import { applyClasses, toggleElement } from './utils'

describe('ui utils', () => {
  it('applies string, array, object, and required classes', () => {
    const element = document.createElement('div')

    applyClasses(element, 'one two', 'required')
    expect([...element.classList]).toEqual(['one', 'two', 'required'])

    applyClasses(element, ['three', 'four'])
    expect([...element.classList]).toEqual(['three', 'four'])

    applyClasses(element, { five: true, six: false, seven: true })
    expect([...element.classList]).toEqual(['five', 'seven'])

    applyClasses(element, null as unknown as string)
    expect(element.className).toBe('')
  })

  it('toggles an element through a placeholder', () => {
    const parent = document.createElement('div')
    const element = document.createElement('span')
    const onHide = vi.fn()
    const onShow = vi.fn()
    parent.append(element)
    const toggle = toggleElement(element, { onHide, onShow })

    toggle(false)
    expect(parent.firstChild).toBeInstanceOf(Comment)
    expect(onHide).toHaveBeenCalledWith(element)

    toggle(true)
    expect(parent.firstChild).toBe(element)
    expect(onShow).toHaveBeenCalledWith(element, true)

    toggle('visible')
    expect(onShow).toHaveBeenCalledWith(element, 'visible')

    toggle(false)
    expect(parent.firstChild).toBeInstanceOf(Comment)
    expect(onHide).toHaveBeenCalledTimes(2)
  })
})

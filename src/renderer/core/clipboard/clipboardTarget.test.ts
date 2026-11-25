import { beforeEach, describe, expect, it } from 'vitest'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import { shouldIgnoreCopyPaste } from './clipboardTarget'

function mount<T extends HTMLElement>(element: T): T {
  document.body.append(element)
  return element
}

beforeEach(() => {
  document.body.replaceChildren()
  window.getSelection()?.removeAllRanges()
})

describe('shouldIgnoreCopyPaste', () => {
  it.for([
    {
      name: 'a textarea',
      make: () => document.createElement('textarea')
    },
    {
      name: 'a text input',
      make: () =>
        Object.assign(document.createElement('input'), { type: 'text' })
    },
    {
      name: 'a search input',
      make: () =>
        Object.assign(document.createElement('input'), { type: 'search' })
    },
    {
      name: 'a contenteditable element',
      make: () =>
        Object.assign(document.createElement('div'), {
          contentEditable: 'true'
        })
    }
  ])('ignores events targeting $name', ({ make }) => {
    expect(shouldIgnoreCopyPaste(mount(make()))).toBe(true)
  })

  it('handles events targeting a button input', () => {
    const button = mount(
      Object.assign(document.createElement('input'), { type: 'button' })
    )
    expect(shouldIgnoreCopyPaste(button)).toBe(false)
  })

  it('ignores events while text is selected anywhere', () => {
    const canvas = mount(document.createElement('canvas'))
    const paragraph = mount(document.createElement('p'))
    paragraph.textContent = 'agent reply'
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    window.getSelection()?.addRange(range)

    expect(shouldIgnoreCopyPaste(canvas)).toBe(true)
  })

  it('handles events without a text selection', () => {
    expect(shouldIgnoreCopyPaste(mount(document.createElement('canvas')))).toBe(
      false
    )
  })

  it('leaves clipboard events to linear mode', () => {
    useCanvasStore().linearMode = true

    expect(shouldIgnoreCopyPaste(document)).toBe(true)
  })
})

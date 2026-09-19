import { beforeEach, describe, expect, it } from 'vitest'

// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  collapseTextSelectionOutside,
  shouldIgnoreCopyPaste
} from '@/workbench/eventHelpers'

function mount<T extends HTMLElement>(element: T): T {
  document.body.append(element)
  return element
}

function selectTextOf(element: Element): void {
  const range = document.createRange()
  range.selectNodeContents(element)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function textBlock(text: string): HTMLParagraphElement {
  const block = document.createElement('p')
  block.textContent = text
  return block
}

describe('shouldIgnoreCopyPaste', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    window.getSelection()?.removeAllRanges()
  })

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
    selectTextOf(mount(textBlock('agent reply')))

    expect(shouldIgnoreCopyPaste(canvas)).toBe(true)
  })

  it('handles events without a text selection', () => {
    expect(shouldIgnoreCopyPaste(mount(document.createElement('canvas')))).toBe(
      false
    )
  })

  it('ignores every event in linear mode', () => {
    useCanvasStore().linearMode = true
    const canvas = mount(document.createElement('canvas'))

    expect(shouldIgnoreCopyPaste(canvas)).toBe(true)
  })
})

describe('collapseTextSelectionOutside', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    window.getSelection()?.removeAllRanges()
  })

  it('collapses a selection that starts outside the container', () => {
    const container = mount(document.createElement('div'))
    selectTextOf(mount(textBlock('agent reply')))

    collapseTextSelectionOutside(container)

    expect(window.getSelection()?.toString()).toBe('')
  })

  it('keeps a selection inside the container', () => {
    const container = mount(document.createElement('div'))
    const text = textBlock('node title')
    container.append(text)
    selectTextOf(text)

    collapseTextSelectionOutside(container)

    expect(window.getSelection()?.toString()).toBe('node title')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { shouldIgnoreCopyPaste } from '@/workbench/eventHelpers'

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

  it('handles events targeting the canvas while text is selected elsewhere', () => {
    const canvas = mount(document.createElement('canvas'))
    selectTextOf(mount(textBlock('agent reply')))

    expect(shouldIgnoreCopyPaste(canvas)).toBe(false)
  })

  it('ignores events whose target contains the selected text', () => {
    const panel = mount(document.createElement('section'))
    const text = textBlock('selected inside the target')
    panel.append(text)
    selectTextOf(text)

    expect(shouldIgnoreCopyPaste(panel)).toBe(true)
  })

  it('ignores events with no focused element while text is selected', () => {
    selectTextOf(mount(textBlock('agent reply')))

    expect(shouldIgnoreCopyPaste(document.body)).toBe(true)
  })

  it('handles events with no focused element and no selection', () => {
    expect(shouldIgnoreCopyPaste(document.body)).toBe(false)
  })

  it('ignores every event in linear mode', () => {
    useCanvasStore().linearMode = true
    const canvas = mount(document.createElement('canvas'))

    expect(shouldIgnoreCopyPaste(canvas)).toBe(true)
  })
})

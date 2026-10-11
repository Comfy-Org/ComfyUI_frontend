import { beforeEach, describe, expect, it } from 'vitest'

import {
  collapseOutsideSelectionOnPrimaryPointerDown,
  collapseTextSelectionOutside,
  hasTextSelection,
  shouldIgnoreCopyPaste
} from '@/workbench/eventHelpers'

function mount<T extends HTMLElement>(element: T): T {
  document.body.append(element)
  return element
}

function select(range: Range): void {
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function selectTextOf(element: Element): void {
  const range = document.createRange()
  range.selectNodeContents(element)
  select(range)
}

function textBlock(text: string): HTMLParagraphElement {
  const block = document.createElement('p')
  block.textContent = text
  return block
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
    selectTextOf(mount(textBlock('agent reply')))

    expect(shouldIgnoreCopyPaste(canvas)).toBe(true)
  })

  it('handles events without a text selection', () => {
    expect(shouldIgnoreCopyPaste(mount(document.createElement('canvas')))).toBe(
      false
    )
  })
})

describe('hasTextSelection', () => {
  it.for([
    { name: 'textarea', make: () => document.createElement('textarea') },
    {
      name: 'search input',
      make: () =>
        Object.assign(document.createElement('input'), { type: 'search' })
    }
  ])('detects selected text in a $name', ({ make }) => {
    const input = mount(make())
    input.value = 'selected text'
    input.setSelectionRange(0, 'selected'.length)

    expect(hasTextSelection(input)).toBe(true)
  })

  it('detects whitespace-only document text', () => {
    selectTextOf(mount(textBlock('   ')))

    expect(hasTextSelection(document)).toBe(true)
  })
})

describe('collapseTextSelectionOutside', () => {
  it('collapses a selection that starts outside the container', () => {
    const container = mount(document.createElement('div'))
    selectTextOf(mount(textBlock('agent reply')))

    collapseTextSelectionOutside(container)

    expect(window.getSelection()?.toString()).toBe('')
  })

  it('collapses a selection anchored inside the container that extends outside it', () => {
    const container = mount(document.createElement('div'))
    const inside = textBlock('inside')
    container.append(inside)
    const outside = mount(textBlock('outside'))
    const range = document.createRange()
    range.setStart(inside, 0)
    range.setEnd(outside, 1)
    select(range)

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

describe('collapseOutsideSelectionOnPrimaryPointerDown', () => {
  it.for([
    { button: 'primary', code: 0, selected: '' },
    { button: 'middle', code: 1, selected: 'agent reply' },
    { button: 'secondary', code: 2, selected: 'agent reply' }
  ])(
    'a $button pointerdown leaves the outside selection as "$selected"',
    ({ code, selected }) => {
      const graph = mount(document.createElement('div'))
      graph.addEventListener(
        'pointerdown',
        collapseOutsideSelectionOnPrimaryPointerDown
      )
      selectTextOf(mount(textBlock('agent reply')))

      graph.dispatchEvent(
        new PointerEvent('pointerdown', { button: code, bubbles: true })
      )

      expect(window.getSelection()?.toString()).toBe(selected)
    }
  )
})

import { describe, expect, it } from 'vitest'

import { canvasCommandForWrittenKeys } from './canvasActionShortcuts'

describe('canvasCommandForWrittenKeys', () => {
  it('names the command a canvas action ships with', () => {
    expect(canvasCommandForWrittenKeys(['Ctrl', 'b'])).toBe(
      'Comfy.Canvas.ToggleSelectedNodes.Bypass'
    )
  })

  it('folds the macOS spellings onto the labels this app uses', () => {
    const spellings = [
      ['Cmd', 'B'],
      ['Command', 'b'],
      ['⌘', 'B'],
      ['CTRL', 'B']
    ].map(canvasCommandForWrittenKeys)

    expect(spellings).toEqual(
      Array.from({ length: 4 }, () => 'Comfy.Canvas.ToggleSelectedNodes.Bypass')
    )
  })

  it('folds Option onto Alt', () => {
    expect(canvasCommandForWrittenKeys(['Option', 'c'])).toBe(
      'Comfy.Canvas.ToggleSelectedNodes.Collapse'
    )
  })

  it('reads a named key, not only a letter', () => {
    expect(canvasCommandForWrittenKeys(['Ctrl', 'Enter'])).toBe(
      'Comfy.QueuePrompt'
    )
  })

  it('has no command for a combo no canvas action ships', () => {
    expect(canvasCommandForWrittenKeys(['Ctrl', 'z'])).toBeUndefined()
  })

  it('has no command for a modifier run with no key', () => {
    expect(canvasCommandForWrittenKeys(['Ctrl', 'Shift'])).toBeUndefined()
  })

  it('does not answer for a combo that belongs to another command', () => {
    expect(canvasCommandForWrittenKeys(['Ctrl', 'Shift', 'b'])).toBeUndefined()
  })
})

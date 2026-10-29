import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { describe, expect, it } from 'vitest'

import {
  CANVAS_ACTION_COMMAND_IDS,
  canvasCommandForWrittenKeys,
  modifierLabel
} from './canvasActionShortcuts'
import { CORE_KEYBINDINGS } from './defaults'

describe('CANVAS_ACTION_COMMAND_IDS', () => {
  it('lists only actions a reply could name, which needs a modifier', () => {
    const unreachable = CORE_KEYBINDINGS.filter(
      (keybinding) =>
        CANVAS_ACTION_COMMAND_IDS.has(keybinding.commandId) &&
        !new KeybindingImpl(keybinding).combo.hasModifier
    ).map((keybinding) => keybinding.commandId)

    expect(unreachable).toEqual([])
  })

  it('lists only commands the app actually ships a default for', () => {
    const shipped = new Set(CORE_KEYBINDINGS.map((it) => it.commandId))
    const missing = [...CANVAS_ACTION_COMMAND_IDS].filter(
      (commandId) => !shipped.has(commandId)
    )

    expect(missing).toEqual([])
  })
})

describe('modifierLabel', () => {
  it('names a modifier however it was spelled', () => {
    expect(['Cmd', 'COMMAND', 'meta', '⌘'].map(modifierLabel)).toEqual(
      Array.from({ length: 4 }, () => 'Ctrl')
    )
  })

  it('has no label for a key that is not a modifier', () => {
    expect(modifierLabel('Enter')).toBeUndefined()
  })
})

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

  it('reads a modifier run written in another order', () => {
    expect(canvasCommandForWrittenKeys(['Shift', 'Ctrl', 'e'])).toBe(
      'Comfy.Graph.ConvertToSubgraph'
    )
  })

  it('reads a named key, not only a letter', () => {
    expect(canvasCommandForWrittenKeys(['Ctrl', 'Enter'])).toBe(
      'Comfy.QueuePrompt'
    )
  })

  it('folds a named-key synonym onto the key the command ships', () => {
    expect(canvasCommandForWrittenKeys(['Cmd', 'Return'])).toBe(
      'Comfy.QueuePrompt'
    )
  })

  it('answers for each of a command with several defaults', () => {
    const zoomIn = [
      ['Alt', '='],
      ['Alt', 'Shift', '+'],
      ['Alt', '+']
    ].map(canvasCommandForWrittenKeys)

    expect(zoomIn).toEqual(
      Array.from({ length: 3 }, () => 'Comfy.Canvas.ZoomIn')
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

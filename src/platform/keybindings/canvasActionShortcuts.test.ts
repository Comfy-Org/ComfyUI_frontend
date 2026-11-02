import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { describe, expect, it } from 'vitest'

import {
  canvasCommandForWrittenKeys,
  modifierLabel
} from './canvasActionShortcuts'
import { CORE_KEYBINDINGS } from './defaults'

describe('canvasCommandForWrittenKeys over the shipped defaults', () => {
  it('answers for every modifier-bearing default the app ships', () => {
    const unreachable = CORE_KEYBINDINGS.filter((keybinding) => {
      const combo = new KeybindingImpl(keybinding).combo
      return (
        combo.hasModifier &&
        canvasCommandForWrittenKeys(combo.getKeySequences()) === undefined
      )
    }).map((keybinding) => keybinding.commandId)

    expect(unreachable).toEqual([])
  })

  it('answers for a shortcut outside the canvas, such as paste and connect', () => {
    expect(canvasCommandForWrittenKeys(['Ctrl', 'Shift', 'v'])).toBe(
      'Comfy.Canvas.PasteFromClipboardWithConnect'
    )
  })

  it('has no command for a default that needs no modifier', () => {
    const pin = CORE_KEYBINDINGS.find(
      (keybinding) => keybinding.commandId === 'Comfy.Canvas.ToggleSelected.Pin'
    )
    const keys = new KeybindingImpl(pin!).combo.getKeySequences()

    expect(canvasCommandForWrittenKeys(keys)).toBeUndefined()
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

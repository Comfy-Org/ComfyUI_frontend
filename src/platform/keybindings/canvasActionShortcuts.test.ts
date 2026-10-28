import { describe, expect, it } from 'vitest'

import { CANVAS_ACTION_COMMAND_IDS } from './canvasActionShortcuts'
import { CORE_KEYBINDINGS } from './defaults'

describe('CANVAS_ACTION_COMMAND_IDS', () => {
  // The whole point of resolving keys at render time is that nothing has to
  // restate them. That only holds while every command here is still bound: an
  // id that no longer appears in the defaults resolves to nothing, and the
  // agent's reply silently loses its keycap instead of failing anywhere.
  it('names only commands the shipped defaults bind a key to', () => {
    const bound = new Set(CORE_KEYBINDINGS.map((k) => k.commandId))
    const unbound = Object.entries(CANVAS_ACTION_COMMAND_IDS).filter(
      ([, commandId]) => !bound.has(commandId)
    )
    expect(unbound).toEqual([])
  })

  it('keys every action by a lower-case phrase, so matching can fold case', () => {
    for (const phrase of Object.keys(CANVAS_ACTION_COMMAND_IDS)) {
      expect(phrase).toBe(phrase.toLowerCase())
    }
  })
})

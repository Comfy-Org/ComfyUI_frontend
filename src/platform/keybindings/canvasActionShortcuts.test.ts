import { describe, expect, it } from 'vitest'

import { CANVAS_ACTION_COMMAND_IDS } from './canvasActionShortcuts'
import { CORE_KEYBINDINGS } from './defaults'

describe('CANVAS_ACTION_COMMAND_IDS', () => {
  it('names only commands the shipped defaults bind a key to', () => {
    const bound = new Set(CORE_KEYBINDINGS.map((k) => k.commandId))
    const unbound = Object.entries(CANVAS_ACTION_COMMAND_IDS)
      .filter(([, commandId]) => !bound.has(commandId))
      .map(([phrase]) => phrase)

    expect(unbound).toEqual([])
  })

  it('keys every action by a lower-case phrase, so matching can fold case', () => {
    const mixedCase = Object.keys(CANVAS_ACTION_COMMAND_IDS).filter(
      (phrase) => phrase !== phrase.toLowerCase()
    )

    expect(mixedCase).toEqual([])
  })
})

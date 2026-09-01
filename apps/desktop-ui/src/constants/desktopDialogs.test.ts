import { describe, expect, it } from 'vitest'

import { DESKTOP_DIALOGS, getDialog } from '@/constants/desktopDialogs'

describe('getDialog', () => {
  it('returns the matching dialog for a valid ID', () => {
    const result = getDialog('reinstallVenv')
    expect(result.id).toBe('reinstallVenv')
    expect(result.title).toBe(DESKTOP_DIALOGS.reinstallVenv.title)
    expect(result.message).toBe(DESKTOP_DIALOGS.reinstallVenv.message)
  })

  it('returns invalidDialog for an unknown string ID', () => {
    const result = getDialog('unknownDialog')
    expect(result.id).toBe('invalidDialog')
  })

  it('returns invalidDialog when given an array of strings', () => {
    const result = getDialog(['reinstallVenv', 'other'])
    expect(result.id).toBe('invalidDialog')
  })

  it('returns invalidDialog for empty string', () => {
    const result = getDialog('')
    expect(result.id).toBe('invalidDialog')
  })

  it('returns a deep clone — mutations do not affect the original', () => {
    const result = getDialog('reinstallVenv')
    const originalFirstLabel = DESKTOP_DIALOGS.reinstallVenv.buttons[0].label
    result.buttons[0].label = 'Mutated'
    expect(DESKTOP_DIALOGS.reinstallVenv.buttons[0].label).toBe(
      originalFirstLabel
    )
  })

  it('every button has a returnValue', () => {
    for (const id of Object.keys(DESKTOP_DIALOGS)) {
      const result = getDialog(id)
      for (const button of result.buttons) {
        expect(button.returnValue).toBeDefined()
      }
    }
  })

  it('invalidDialog has a close/cancel button', () => {
    const result = getDialog('invalidDialog')
    expect(result.buttons.some((b) => b.action === 'cancel')).toBe(true)
  })
})

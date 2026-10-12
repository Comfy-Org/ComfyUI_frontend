import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearEscapeOverrides,
  consultEscapeOverride,
  registerEscapeOverride
} from './escapeOverride'

function escapeEvent(): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
}

afterEach(() => {
  clearEscapeOverrides()
})

describe('escapeOverride', () => {
  it('reports unhandled when nothing is registered', () => {
    expect(consultEscapeOverride(escapeEvent())).toBe(false)
  })

  it('consults a registered handler and returns its verdict', () => {
    const handler = vi.fn().mockReturnValue(true)
    registerEscapeOverride(handler)

    const event = escapeEvent()
    expect(consultEscapeOverride(event)).toBe(true)
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('stops calling a handler once it is unregistered', () => {
    const handler = vi.fn().mockReturnValue(true)
    const unregister = registerEscapeOverride(handler)
    unregister()

    expect(consultEscapeOverride(escapeEvent())).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('unregistering twice is a no-op', () => {
    const handler = vi.fn().mockReturnValue(true)
    const unregister = registerEscapeOverride(handler)
    unregister()
    expect(() => unregister()).not.toThrow()
    expect(consultEscapeOverride(escapeEvent())).toBe(false)
  })

  it('consults the most-recently-registered handler first', () => {
    const older = vi.fn().mockReturnValue(true)
    const newer = vi.fn().mockReturnValue(true)
    registerEscapeOverride(older)
    registerEscapeOverride(newer)

    consultEscapeOverride(escapeEvent())

    expect(newer).toHaveBeenCalled()
    expect(older).not.toHaveBeenCalled()
  })

  it('falls through to an older handler when the newer one declines', () => {
    const older = vi.fn().mockReturnValue(true)
    const newer = vi.fn().mockReturnValue(false)
    registerEscapeOverride(older)
    registerEscapeOverride(newer)

    expect(consultEscapeOverride(escapeEvent())).toBe(true)
    expect(newer).toHaveBeenCalled()
    expect(older).toHaveBeenCalled()
  })
})

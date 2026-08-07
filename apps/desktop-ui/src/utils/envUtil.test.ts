import { describe, expect, it, vi } from 'vitest'

import { isElectron, isNativeWindow } from '@/utils/envUtil'

function windowWith(overrides: Record<string, unknown>) {
  return Object.assign(Object.create(window) as Window, overrides)
}

function navigatorWith(overrides: Record<string, unknown>) {
  return Object.assign(Object.create(window.navigator) as Navigator, overrides)
}

describe('isElectron', () => {
  it('returns true when window.electronAPI is an object', () => {
    vi.stubGlobal('window', windowWith({ electronAPI: {} }))
    expect(isElectron()).toBe(true)
  })

  it('returns false when window.electronAPI is undefined', () => {
    vi.stubGlobal('window', windowWith({ electronAPI: undefined }))
    expect(isElectron()).toBe(false)
  })

  it('returns false when window.electronAPI is absent', () => {
    const copy = windowWith({})
    delete copy['electronAPI']
    vi.stubGlobal('window', copy)
    expect(isElectron()).toBe(false)
  })
})

describe('isNativeWindow', () => {
  it('returns true when Electron and windowControlsOverlay.visible is true', () => {
    vi.stubGlobal(
      'window',
      windowWith({
        electronAPI: {},
        navigator: navigatorWith({
          windowControlsOverlay: { visible: true }
        })
      })
    )
    expect(isNativeWindow()).toBe(true)
  })

  it('returns false when not in Electron', () => {
    const copy = windowWith({})
    delete copy['electronAPI']
    vi.stubGlobal('window', copy)
    expect(isNativeWindow()).toBe(false)
  })

  it('returns false when windowControlsOverlay.visible is false', () => {
    vi.stubGlobal(
      'window',
      windowWith({
        electronAPI: {},
        navigator: navigatorWith({
          windowControlsOverlay: { visible: false }
        })
      })
    )
    expect(isNativeWindow()).toBe(false)
  })

  it('returns false when windowControlsOverlay is absent', () => {
    vi.stubGlobal(
      'window',
      windowWith({
        electronAPI: {},
        navigator: navigatorWith({ windowControlsOverlay: undefined })
      })
    )
    expect(isNativeWindow()).toBe(false)
  })
})

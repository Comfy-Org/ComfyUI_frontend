import { afterEach, describe, expect, it, vi } from 'vitest'

import { isElectron, isNativeWindow } from '@/utils/envUtil'

describe('isElectron', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when window.electronAPI is an object', () => {
    vi.stubGlobal('window', { ...window, electronAPI: {} })
    expect(isElectron()).toBe(true)
  })

  it('returns false when window.electronAPI is undefined', () => {
    vi.stubGlobal('window', { ...window, electronAPI: undefined })
    expect(isElectron()).toBe(false)
  })

  it('returns false when window.electronAPI is absent', () => {
    const copy = { ...window } as Record<string, unknown>
    delete copy['electronAPI']
    vi.stubGlobal('window', copy)
    expect(isElectron()).toBe(false)
  })
})

describe('isNativeWindow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when Electron and windowControlsOverlay.visible is true', () => {
    vi.stubGlobal('window', {
      ...window,
      electronAPI: {},
      navigator: {
        ...window.navigator,
        windowControlsOverlay: { visible: true }
      }
    })
    expect(isNativeWindow()).toBe(true)
  })

  it('returns false when not in Electron', () => {
    const copy = { ...window } as Record<string, unknown>
    delete copy['electronAPI']
    vi.stubGlobal('window', copy)
    expect(isNativeWindow()).toBe(false)
  })

  it('returns false when windowControlsOverlay.visible is false', () => {
    vi.stubGlobal('window', {
      ...window,
      electronAPI: {},
      navigator: {
        ...window.navigator,
        windowControlsOverlay: { visible: false }
      }
    })
    expect(isNativeWindow()).toBe(false)
  })

  it('returns false when windowControlsOverlay is absent', () => {
    vi.stubGlobal('window', {
      ...window,
      electronAPI: {},
      navigator: { ...window.navigator, windowControlsOverlay: undefined }
    })
    expect(isNativeWindow()).toBe(false)
  })
})

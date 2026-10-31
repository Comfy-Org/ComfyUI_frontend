import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { attachLegacyUI } from '@/core/legacyUI/attachLegacyUI'
import { ComfyApp } from '@/scripts/app'

function attachToFreshApp() {
  const app = new ComfyApp()
  onTestFinished(attachLegacyUI(app))
  return app
}

function installThrowingLocalStorage() {
  vi.stubGlobal('localStorage', {
    getItem() {
      throw new Error('Access to storage is not allowed from this context.')
    },
    setItem() {
      throw new Error('Access to storage is not allowed from this context.')
    }
  })
}

describe('menu position restore is resilient to unusable localStorage', () => {
  it('attaches the legacy UI when localStorage is a non-functional stub', () => {
    vi.stubGlobal('localStorage', {})

    const app = attachToFreshApp()

    expect(app.ui.restoreMenuPosition).toBeTypeOf('function')
  })

  it('restores quietly when localStorage throws on access', () => {
    const app = attachToFreshApp()
    installThrowingLocalStorage()

    expect(() => app.ui.restoreMenuPosition()).not.toThrow()
  })

  it('restores quietly when the stored position is corrupt JSON', () => {
    const app = attachToFreshApp()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => '{not valid json'),
      setItem: vi.fn()
    })

    expect(() => app.ui.restoreMenuPosition()).not.toThrow()
  })

  it('restores quietly when persisting the restored position fails', () => {
    const app = attachToFreshApp()
    const setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ x: 12, y: 34 })),
      setItem
    })
    app.ui.menuContainer.style.display = 'block'

    expect(() => app.ui.restoreMenuPosition()).not.toThrow()
    expect(setItem).toHaveBeenCalled()
  })
})

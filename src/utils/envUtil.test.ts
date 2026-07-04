import { beforeEach, describe, expect, it, vi } from 'vitest'

const distributionState = vi.hoisted(() => ({
  isDesktop: false
}))

vi.mock('@/platform/distribution/types', () => ({
  get isDesktop() {
    return distributionState.isDesktop
  }
}))

beforeEach(() => {
  vi.resetModules()
  Reflect.deleteProperty(window, 'electronAPI')
  Object.defineProperty(window.navigator, 'windowControlsOverlay', {
    configurable: true,
    value: undefined
  })
})

async function importEnvUtil(isDesktop: boolean) {
  distributionState.isDesktop = isDesktop
  return await import('@/utils/envUtil')
}

describe('envUtil', () => {
  it('returns and uses the Electron API when present', async () => {
    const showContextMenu = vi.fn()
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { showContextMenu }
    })
    const envUtil = await importEnvUtil(true)

    expect(envUtil.electronAPI()).toEqual({ showContextMenu })

    envUtil.showNativeSystemMenu()

    expect(showContextMenu).toHaveBeenCalled()
  })

  it('detects native windows only in desktop window-control overlays', async () => {
    Object.defineProperty(window.navigator, 'windowControlsOverlay', {
      configurable: true,
      value: { visible: true }
    })

    expect((await importEnvUtil(true)).isNativeWindow()).toBe(true)

    vi.resetModules()
    expect((await importEnvUtil(false)).isNativeWindow()).toBe(false)
  })

  it('tolerates a missing Electron API for native menu calls', async () => {
    const envUtil = await importEnvUtil(true)

    expect(() => envUtil.showNativeSystemMenu()).not.toThrow()
  })
})

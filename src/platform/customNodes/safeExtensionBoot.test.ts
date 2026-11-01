import { beforeEach, describe, expect, it, vi } from 'vitest'

async function freshModule() {
  vi.resetModules()
  return import('./customNodeScripts')
}

describe('captureSafeExtensionBoot', { timeout: 30_000 }, () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('keeps safe mode for this load and drops the flag from the URL', async () => {
    window.history.replaceState({ kept: true }, '', '/?safe&workflow=a#graph')
    const { captureSafeExtensionBoot, isSafeExtensionBootActive } =
      await freshModule()

    captureSafeExtensionBoot()

    expect(window.location.search).toBe('?workflow=a')
    expect(window.location.hash).toBe('#graph')
    expect(window.history.state).toEqual({ kept: true })
    expect(isSafeExtensionBootActive()).toBe(true)
  })

  it('leaves a URL without the flag untouched', async () => {
    window.history.replaceState(null, '', '/?safe=0&workflow=a')
    const { captureSafeExtensionBoot, isSafeExtensionBootActive } =
      await freshModule()

    captureSafeExtensionBoot()

    expect(window.location.search).toBe('?safe=0&workflow=a')
    expect(isSafeExtensionBootActive()).toBe(false)
  })

  it('reads the flag from the URL when nothing captured it first', async () => {
    window.history.replaceState(null, '', '/?safe=1')
    const { isSafeExtensionBootActive } = await freshModule()

    expect(isSafeExtensionBootActive()).toBe(true)
  })
})

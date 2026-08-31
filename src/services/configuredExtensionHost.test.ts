import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

import {
  hasExclusiveExtensionHost,
  hasExtensionHost,
  provideExtensionHost
} from './extensionHostProvider'
import { installConfiguredExtensionHost } from './configuredExtensionHost'

beforeEach(() => {
  remoteConfig.value = {}
  provideExtensionHost(null)
})

afterEach(() => {
  provideExtensionHost(null)
})

describe('configured extension host', () => {
  it('preserves local extension loading when no host is configured', async () => {
    const loadModule = vi.fn()

    expect(await installConfiguredExtensionHost(loadModule)).toBe(false)
    expect(loadModule).not.toHaveBeenCalled()
    expect(hasExtensionHost()).toBe(false)
  })

  it('installs an exclusive host before extensions load', async () => {
    remoteConfig.value = {
      extension_host: { module_url: '/isolated/entry.mjs' }
    }
    const loadModule = vi.fn(async () => ({
      install: ({
        provideExtensionHost: provide
      }: ExtensionHostInstallContext) =>
        provide({
          name: 'isolated',
          policy: 'exclusive',
          canLoad: () => true,
          load: vi.fn(async () => {})
        })
    }))

    expect(await installConfiguredExtensionHost(loadModule)).toBe(true)
    expect(loadModule).toHaveBeenCalledWith(
      new URL('/isolated/entry.mjs', globalThis.location.href).href
    )
    expect(hasExclusiveExtensionHost()).toBe(true)
  })

  it('fails closed when the configured module has no installer', async () => {
    remoteConfig.value = {
      extension_host: { module_url: '/broken/entry.mjs' }
    }

    await expect(
      installConfiguredExtensionHost(async () => ({}))
    ).rejects.toThrow('has no install export')
    expect(hasExtensionHost()).toBe(false)
  })

  it('rejects a configured host that permits local fallback', async () => {
    remoteConfig.value = {
      extension_host: { module_url: '/selective/entry.mjs' }
    }

    await expect(
      installConfiguredExtensionHost(async () => ({
        install: ({
          provideExtensionHost: provide
        }: ExtensionHostInstallContext) =>
          provide({
            name: 'selective',
            policy: 'selective',
            canLoad: () => true,
            load: vi.fn(async () => {})
          })
      }))
    ).rejects.toThrow('is not exclusive')
    expect(hasExtensionHost()).toBe(false)
  })
})

interface ExtensionHostInstallContext {
  provideExtensionHost: typeof provideExtensionHost
  comfy: unknown
}

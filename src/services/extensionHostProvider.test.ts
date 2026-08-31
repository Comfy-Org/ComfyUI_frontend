import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  hasExclusiveExtensionHost,
  hasExtensionHost,
  provideExtensionHost,
  resolveExtensionHost
} from './extensionHostProvider'
import type { ExtensionHostProvider } from './extensionHostProvider'

const makeProvider = (
  overrides: Partial<ExtensionHostProvider> = {}
): ExtensionHostProvider => ({
  name: 'test-host',
  canLoad: () => true,
  load: vi.fn(async () => {}),
  ...overrides
})

afterEach(() => {
  provideExtensionHost(null)
})

describe('extension host provider', () => {
  it('is absent by default, so loading behaves exactly as before', () => {
    expect(hasExtensionHost()).toBe(false)
    expect(resolveExtensionHost('/extensions/foo/main.js')).toBeNull()
  })

  it('resolves an installed provider that claims the extension', () => {
    const provider = makeProvider()
    provideExtensionHost(provider)

    expect(hasExtensionHost()).toBe(true)
    expect(hasExclusiveExtensionHost()).toBe(false)
    expect(resolveExtensionHost('/extensions/foo/main.js')).toBe(provider)
  })

  it('falls through when the provider declines an extension', () => {
    provideExtensionHost(
      makeProvider({ canLoad: (url) => url.includes('sandboxed') })
    )

    expect(resolveExtensionHost('/extensions/sandboxed/main.js')).not.toBeNull()
    expect(resolveExtensionHost('/extensions/other/main.js')).toBeNull()
  })

  it('routes every third-party extension through an exclusive provider', () => {
    const provider = makeProvider({
      policy: 'exclusive',
      canLoad: () => false
    })
    provideExtensionHost(provider)

    expect(resolveExtensionHost('/extensions/other/main.js')).toBe(provider)
    expect(hasExclusiveExtensionHost()).toBe(true)
  })

  it('does not break extension loading when canLoad throws', () => {
    provideExtensionHost(
      makeProvider({
        canLoad: () => {
          throw new Error('provider is broken')
        }
      })
    )

    // Must degrade to the normal import() path rather than propagating.
    expect(resolveExtensionHost('/extensions/foo/main.js')).toBeNull()
  })

  it('can be uninstalled, restoring default loading', () => {
    provideExtensionHost(makeProvider())
    expect(hasExtensionHost()).toBe(true)

    provideExtensionHost(null)
    expect(hasExtensionHost()).toBe(false)
    expect(resolveExtensionHost('/extensions/foo/main.js')).toBeNull()
  })
})

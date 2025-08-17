import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthHeaderProvider } from '@/providers/authHeaderProvider'
import { headerRegistry } from '@/services/headerRegistry'

// Mock the providers module
vi.mock('@/providers/authHeaderProvider', () => ({
  AuthHeaderProvider: vi.fn()
}))

// Mock headerRegistry
vi.mock('@/services/headerRegistry', () => ({
  headerRegistry: {
    registerHeaderProvider: vi.fn()
  }
}))

// Mock app
const mockApp = {
  registerExtension: vi.fn()
}

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

describe('authHeaders extension', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module cache to ensure fresh imports
    vi.resetModules()
  })

  it('should register extension with correct name', async () => {
    // Import the extension (this will call app.registerExtension)
    await import('@/extensions/core/authHeaders')

    expect(mockApp.registerExtension).toHaveBeenCalledOnce()
    const extensionConfig = mockApp.registerExtension.mock.calls[0][0]
    expect(extensionConfig.name).toBe('Comfy.AuthHeaders')
  })

  it('should register auth header provider in preInit hook', async () => {
    // Import the extension
    await import('@/extensions/core/authHeaders')

    const extensionConfig = mockApp.registerExtension.mock.calls[0][0]
    expect(extensionConfig.preInit).toBeDefined()

    // Call the preInit hook
    await extensionConfig.preInit({})

    // Verify AuthHeaderProvider was instantiated
    expect(AuthHeaderProvider).toHaveBeenCalledOnce()

    // Verify header provider was registered with high priority
    expect(headerRegistry.registerHeaderProvider).toHaveBeenCalledWith(
      expect.any(Object), // The AuthHeaderProvider instance
      { priority: 1000 }
    )
  })

  it('should log initialization messages', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Import the extension
    await import('@/extensions/core/authHeaders')

    const extensionConfig = mockApp.registerExtension.mock.calls[0][0]

    // Call the preInit hook
    await extensionConfig.preInit({})

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[AuthHeaders] Registering authentication header provider'
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[AuthHeaders] Authentication headers will be automatically injected'
    )

    consoleLogSpy.mockRestore()
  })
})

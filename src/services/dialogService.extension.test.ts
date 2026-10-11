import { expect, it, vi } from 'vitest'

it.for([true, false])(
  'throws the same TypeError before registration when DEV is %s',
  async (dev) => {
    vi.stubEnv('DEV', dev)
    try {
      vi.resetModules()
      const { useExtensionDialogService } = await import('./dialogService')

      expect(() => useExtensionDialogService()).toThrowError(TypeError)
      expect(() => useExtensionDialogService()).toThrow(
        'Extension dialog service accessed before registerExtensionDialogService'
      )
    } finally {
      vi.unstubAllEnvs()
    }
  }
)

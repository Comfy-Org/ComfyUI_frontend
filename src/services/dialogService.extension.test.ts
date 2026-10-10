import { expect, it, vi } from 'vitest'

it('refuses access before the extension dialog service is registered', async () => {
  vi.stubEnv('DEV', false)
  try {
    vi.resetModules()
    const { useExtensionDialogService } = await import('./dialogService')

    expect(() => useExtensionDialogService()).toThrow(
      'Extension dialog service accessed before registerExtensionDialogService'
    )
  } finally {
    vi.unstubAllEnvs()
  }
})

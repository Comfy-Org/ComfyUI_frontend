import { describe, expect, it, vi } from 'vitest'

vi.mock(import('@comfyorg/telemetry/reportError'))

async function loadPersistence() {
  vi.resetModules()
  const { useManagerStatePersistence } =
    await import('./useManagerStatePersistence')
  const { reportError } = await import('@comfyorg/telemetry/reportError')
  return { ...useManagerStatePersistence(), reportError }
}

describe('useManagerStatePersistence', () => {
  it('reports an unexpected write failure once', async () => {
    const failure = new Error('Storage driver failed')
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw failure
    })
    const { reset, reportError } = await loadPersistence()

    reset()
    reset()

    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        errorType: 'error_persisting_manager_ui_state'
      })
    )
  })

  it.for([
    ['a full storage', new DOMException('full', 'QuotaExceededError')],
    ['a blocked storage', new DOMException('blocked', 'SecurityError')]
  ] as const)('does not report %s', async ([, failure]) => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw failure
    })
    const { reset, reportError } = await loadPersistence()

    reset()

    expect(reportError).not.toHaveBeenCalled()
  })
})

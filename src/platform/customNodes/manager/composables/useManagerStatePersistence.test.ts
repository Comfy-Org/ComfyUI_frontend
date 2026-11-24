import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

import { useManagerStatePersistence } from './useManagerStatePersistence'

vi.mock(import('@comfyorg/telemetry/reportError'))

describe('useManagerStatePersistence', () => {
  it('reports an unexpected write failure once', () => {
    const failure = new Error('Storage driver failed')
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw failure
    })
    const { reset } = useManagerStatePersistence()

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
  ] as const)('does not report %s', ([, failure]) => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw failure
    })
    const { reset } = useManagerStatePersistence()

    reset()

    expect(reportError).not.toHaveBeenCalled()
  })
})

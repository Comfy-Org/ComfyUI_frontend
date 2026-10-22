import { afterEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { ComfyApi } from '@/scripts/api'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const storage = window.sessionStorage

describe('ComfyApi initial client id', () => {
  afterEach(() => {
    storage.clear()
  })

  it('reuses the client id stored in session storage', () => {
    storage.setItem('clientId', 'stored-client')

    expect(new ComfyApi().initialClientId).toBe('stored-client')
  })

  it('constructs without a client id when session storage access is denied', () => {
    storage.setItem('clientId', 'stored-client')
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    const api = new ComfyApi()

    expect(api.initialClientId).toBeNull()
    expect(api.apiURL('/prompt')).toBe('/api/prompt')
    expect(reportError).toHaveBeenCalledWith(
      expect.any(DOMException),
      expect.objectContaining({
        errorType: 'failure_accessing_client_id_storage'
      })
    )
  })
})

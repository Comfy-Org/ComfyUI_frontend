import type { AxiosResponse } from 'axios'
import axios, { AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useApiRequest } from '@/composables/useApiRequest'

const mockIsAbortError = vi.hoisted(() => vi.fn())

vi.mock<unknown>(import('@/utils/typeGuardUtil'), () => ({
  isAbortError: mockIsAbortError
}))

const client = axios.create()

function response<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() }
  }
}

describe('useApiRequest', () => {
  beforeEach(() => {
    mockIsAbortError.mockReturnValue(false)
  })

  it('returns response data and toggles loading state', async () => {
    const { isLoading, error, executeRequest } = useApiRequest({
      client,
      mapError: vi.fn()
    })
    expect(isLoading.value).toBe(false)

    const pending = executeRequest(async () => response('ok'), {
      errorContext: 'ctx'
    })
    expect(isLoading.value).toBe(true)

    await expect(pending).resolves.toBe('ok')
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('stays loading until every concurrent request settles', async () => {
    const { isLoading, executeRequest } = useApiRequest({
      client,
      mapError: vi.fn()
    })

    let resolveFirst!: (value: AxiosResponse<string>) => void
    const first = executeRequest(
      () => new Promise<AxiosResponse<string>>((res) => (resolveFirst = res)),
      { errorContext: 'ctx' }
    )
    const second = executeRequest(async () => response('second'), {
      errorContext: 'ctx'
    })

    await second
    expect(isLoading.value).toBe(true)

    resolveFirst(response('first'))
    await first
    expect(isLoading.value).toBe(false)
  })

  it('passes the injected client to the api call', async () => {
    const apiCall = vi.fn(async () => response(1))
    const { executeRequest } = useApiRequest({ client, mapError: vi.fn() })

    await executeRequest(apiCall, { errorContext: 'ctx' })

    expect(apiCall).toHaveBeenCalledWith(client)
  })

  it('maps errors through the injected mapper and stores the message', async () => {
    const mapError = vi.fn(() => 'mapped message')
    const routeSpecificErrors = { 404: 'nope' }
    const boom = new Error('boom')
    const { error, executeRequest } = useApiRequest({ client, mapError })

    const result = await executeRequest(
      () => {
        throw boom
      },
      { errorContext: 'ctx', routeSpecificErrors }
    )

    expect(result).toBeNull()
    expect(mapError).toHaveBeenCalledWith(boom, 'ctx', routeSpecificErrors)
    expect(error.value).toBe('mapped message')
  })

  it('swallows cancellations without mapping an error', async () => {
    mockIsAbortError.mockReturnValue(true)
    const mapError = vi.fn(() => 'should not run')
    const { error, executeRequest } = useApiRequest({ client, mapError })

    const result = await executeRequest(
      () => {
        throw new Error('aborted')
      },
      { errorContext: 'ctx' }
    )

    expect(result).toBeNull()
    expect(mapError).not.toHaveBeenCalled()
    expect(error.value).toBeNull()
  })
})

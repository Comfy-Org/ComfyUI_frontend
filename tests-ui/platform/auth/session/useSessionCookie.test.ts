import { describe, expect, it, vi } from 'vitest'

const makeSuccessResponse = () =>
  new Response('{}', {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' }
  })

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void
  let reject: (reason: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  // @ts-expect-error initialized via closure assignments above
  return { promise, resolve, reject }
}

const mockModules = async () => {
  vi.resetModules()

  const getAuthHeader = vi.fn(async () => ({ Authorization: 'Bearer token' }))

  vi.doMock('@/scripts/api', () => ({
    api: {
      apiURL: vi.fn((path: string) => `/api${path}`)
    }
  }))

  vi.doMock('@/platform/distribution/types', () => ({
    isCloud: true
  }))

  vi.doMock('@/stores/firebaseAuthStore', () => ({
    useFirebaseAuthStore: vi.fn(() => ({
      getAuthHeader
    }))
  }))

  const module = await import('@/platform/auth/session/useSessionCookie')
  return { getAuthHeader, useSessionCookie: module.useSessionCookie }
}

describe('useSessionCookie', () => {
  it('deduplicates in-flight session creation', async () => {
    const { useSessionCookie, getAuthHeader } = await mockModules()

    const postDeferred = createDeferred<Response>()

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => postDeferred.promise)

    const { createSession } = useSessionCookie()

    const firstCall = createSession()
    const secondCall = createSession()

    await Promise.resolve()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(getAuthHeader).toHaveBeenCalledTimes(1)

    postDeferred.resolve(makeSuccessResponse())
    await expect(firstCall).resolves.toBeUndefined()
    await expect(secondCall).resolves.toBeUndefined()

    fetchSpy.mockRestore()
  })

  it('aborts pending create on logout and skips new ones while logout is in progress', async () => {
    const { useSessionCookie, getAuthHeader } = await mockModules()

    const firstPostDeferred = createDeferred<Response>()
    const deleteDeferred = createDeferred<Response>()

    let capturedSignal: AbortSignal | undefined

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy
      .mockImplementationOnce((_, init?: RequestInit) => {
        capturedSignal = init?.signal as AbortSignal | undefined
        return firstPostDeferred.promise
      })
      .mockImplementationOnce((_, init?: RequestInit) => {
        expect(init?.method).toBe('DELETE')
        return deleteDeferred.promise
      })
      .mockImplementation((_, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(makeSuccessResponse())
        }
        return Promise.resolve(makeSuccessResponse())
      })

    const { createSession, deleteSession } = useSessionCookie()

    const createPromise = createSession()

    await Promise.resolve()

    const logoutPromise = deleteSession()

    await Promise.resolve()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(capturedSignal?.aborted).toBe(true)

    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    firstPostDeferred.reject(abortError)
    await expect(createPromise).resolves.toBeUndefined()

    await Promise.resolve()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(getAuthHeader).toHaveBeenCalledTimes(1)

    await expect(createSession()).resolves.toBeUndefined()
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    deleteDeferred.resolve(makeSuccessResponse())
    await expect(logoutPromise).resolves.toBeUndefined()

    await expect(createSession()).resolves.toBeUndefined()
    expect(fetchSpy).toHaveBeenCalledTimes(3)

    fetchSpy.mockRestore()
  })
})

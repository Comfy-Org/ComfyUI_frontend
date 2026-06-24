import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  completeDesktopLoginIfNeeded,
  getDesktopLoginRequest,
  hasDesktopLoginRequest
} from './desktopLoginBridge'

const hoisted = vi.hoisted(() => ({
  firebaseConfig: {
    apiKey: 'firebase-api-key'
  } as { apiKey?: string },
  identifyPostHogUser: vi.fn()
}))

vi.mock('@/platform/telemetry/providers/cloud/posthogIdentity', () => ({
  identifyPostHogUser: hoisted.identifyPostHogUser
}))

vi.mock('@/config/firebase', () => ({
  getFirebaseConfig: () => hoisted.firebaseConfig
}))

function createFirebaseUser() {
  return {
    uid: 'user-123',
    toJSON: () => ({ uid: 'user-123', email: 'person@example.com' })
  } as NonNullable<Parameters<typeof completeDesktopLoginIfNeeded>[1]>
}

describe('desktopLoginBridge', () => {
  beforeEach(() => {
    hoisted.firebaseConfig.apiKey = 'firebase-api-key'
    hoisted.identifyPostHogUser.mockClear()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts localhost callback requests with state', () => {
    const query = {
      desktop_login_callback: 'http://localhost:9876/callback',
      desktop_login_state: 'state-123'
    }

    expect(hasDesktopLoginRequest(query)).toBe(true)
    expect(getDesktopLoginRequest(query)).toMatchObject({
      callbackUrl: new URL('http://localhost:9876/callback'),
      state: 'state-123'
    })
  })

  it('rejects non-loopback callback requests', () => {
    expect(
      hasDesktopLoginRequest({
        desktop_login_callback: 'https://evil.example/callback',
        desktop_login_state: 'state-123'
      })
    ).toBe(false)
  })

  it('rejects callback requests without the Desktop callback port', () => {
    expect(
      hasDesktopLoginRequest({
        desktop_login_callback: 'http://localhost:1234/callback',
        desktop_login_state: 'state-123'
      })
    ).toBe(false)
    expect(
      hasDesktopLoginRequest({
        desktop_login_callback: 'http://localhost/callback',
        desktop_login_state: 'state-123'
      })
    ).toBe(false)
  })

  it('identifies the browser PostHog user and posts Firebase user payload to Desktop', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)

    const completed = await completeDesktopLoginIfNeeded(
      {
        desktop_login_callback: 'http://localhost:9876/callback',
        desktop_login_state: 'state-123'
      },
      createFirebaseUser()
    )

    expect(completed).toBe(true)
    expect(hoisted.identifyPostHogUser).toHaveBeenCalledWith('user-123')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:9876/callback',
      expect.objectContaining({
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        signal: expect.any(AbortSignal),
        body: JSON.stringify({
          state: 'state-123',
          apiKey: 'firebase-api-key',
          user: { uid: 'user-123', email: 'person@example.com' }
        })
      })
    )
  })

  it('throws before identifying when the Firebase API key is missing', async () => {
    hoisted.firebaseConfig.apiKey = undefined
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      completeDesktopLoginIfNeeded(
        {
          desktop_login_callback: 'http://localhost:9876/callback',
          desktop_login_state: 'state-123'
        },
        createFirebaseUser()
      )
    ).rejects.toThrow('Firebase API key missing')

    expect(hoisted.identifyPostHogUser).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when Desktop rejects the login callback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    )

    await expect(
      completeDesktopLoginIfNeeded(
        {
          desktop_login_callback: 'http://localhost:9876/callback',
          desktop_login_state: 'state-123'
        },
        createFirebaseUser()
      )
    ).rejects.toThrow('Desktop login callback returned 500')

    expect(hoisted.identifyPostHogUser).toHaveBeenCalledWith('user-123')
  })

  it('aborts the callback request when Desktop does not respond', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    const completion = completeDesktopLoginIfNeeded(
      {
        desktop_login_callback: 'http://localhost:9876/callback',
        desktop_login_state: 'state-123'
      },
      createFirebaseUser()
    )
    const completionResult = completion.catch((error: unknown) => error)

    await vi.advanceTimersByTimeAsync(10_000)

    const completionError = await completionResult
    expect(completionError).toBeInstanceOf(Error)
    if (!(completionError instanceof Error)) {
      throw new Error('Expected Desktop login completion to fail')
    }
    expect(completionError.message).toBe('Desktop login callback timed out')
    expect(completionError.cause).toBeInstanceOf(DOMException)
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    expect(hoisted.identifyPostHogUser).toHaveBeenCalledWith('user-123')
  })

  it('rethrows callback request failures before the timeout elapses', async () => {
    const requestError = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(requestError))

    await expect(
      completeDesktopLoginIfNeeded(
        {
          desktop_login_callback: 'http://localhost:9876/callback',
          desktop_login_state: 'state-123'
        },
        createFirebaseUser()
      )
    ).rejects.toBe(requestError)

    expect(hoisted.identifyPostHogUser).toHaveBeenCalledWith('user-123')
  })
})

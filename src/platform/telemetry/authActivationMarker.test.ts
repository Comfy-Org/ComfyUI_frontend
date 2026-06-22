import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  consumeAuthActivation,
  markAuthForActivation
} from '@/platform/telemetry/authActivationMarker'

const MARKER_KEY = 'comfy:telemetry:auth-activation'

describe('authActivationMarker', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('mark then consume', () => {
    it('returns the stored marker once and then clears the key', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'))
      const expectedAt = Date.now()

      markAuthForActivation(true)

      const marker = consumeAuthActivation()
      expect(marker).toEqual({ at: expectedAt, isNewUser: true })

      // The marker is single-use: a second consume finds nothing.
      expect(consumeAuthActivation()).toBeNull()
      expect(sessionStorage.getItem(MARKER_KEY)).toBeNull()
    })

    it('preserves isNewUser=false through a round trip', () => {
      markAuthForActivation(false)

      const marker = consumeAuthActivation()
      expect(marker?.isNewUser).toBe(false)
      expect(typeof marker?.at).toBe('number')
    })

    it('ignores a marker older than the freshness window', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'))
      markAuthForActivation(true)

      // An unrelated reload minutes later must not report a bogus ms_since_auth.
      vi.setSystemTime(new Date('2026-06-16T00:05:00.000Z'))
      expect(consumeAuthActivation()).toBeNull()
    })
  })

  describe('consume without a valid marker', () => {
    it('returns null when no marker is present', () => {
      expect(consumeAuthActivation()).toBeNull()
    })

    it('returns null and clears the key when the value is garbage', () => {
      sessionStorage.setItem(MARKER_KEY, 'not-json-{')

      expect(consumeAuthActivation()).toBeNull()
      expect(sessionStorage.getItem(MARKER_KEY)).toBeNull()
    })

    it('returns null for a wrong-shape object missing fields', () => {
      sessionStorage.setItem(MARKER_KEY, JSON.stringify({ at: 123 }))

      expect(consumeAuthActivation()).toBeNull()
      // It still consumes (removes) the malformed marker so it is not retried.
      expect(sessionStorage.getItem(MARKER_KEY)).toBeNull()
    })

    it('returns null when fields are present but wrong types', () => {
      sessionStorage.setItem(
        MARKER_KEY,
        JSON.stringify({ at: 'soon', isNewUser: 'yes' })
      )

      expect(consumeAuthActivation()).toBeNull()
      expect(sessionStorage.getItem(MARKER_KEY)).toBeNull()
    })

    it('returns null for a non-object JSON payload', () => {
      sessionStorage.setItem(MARKER_KEY, JSON.stringify(42))

      expect(consumeAuthActivation()).toBeNull()
      expect(sessionStorage.getItem(MARKER_KEY)).toBeNull()
    })
  })

  describe('markAuthForActivation error handling', () => {
    it('swallows a sessionStorage failure without throwing', () => {
      const setItemSpy = vi
        .spyOn(sessionStorage, 'setItem')
        .mockImplementation(() => {
          throw new Error('QuotaExceededError')
        })

      expect(() => markAuthForActivation(true)).not.toThrow()
      expect(setItemSpy).toHaveBeenCalledOnce()
    })
  })
})

/**
 * Comprehensive tests for simplified retry utilities
 *
 * These tests verify that the simplified retry functions provide
 * equivalent functionality to the complex retry state machine.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createCustomRetryStrategy,
  createNetworkRetryStrategy,
  defaultShouldRetry,
  retryBatch,
  retryNetworkOperation,
  retryOperation,
  retryOperationWithDetails,
  waitForOnline
} from '../../browser_tests/utils/simplifiedRetryUtils'

describe('Simplified Retry Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  describe('retryOperation', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await retryOperation(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue('success')

      const promise = retryOperation(operation, { maxAttempts: 3 })

      // Fast-forward through delays
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should throw error after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent error'))

      const promise = retryOperation(operation, { maxAttempts: 2 })

      // Run timers and properly handle the rejection
      const timerPromise = vi.runAllTimersAsync()
      await expect(Promise.all([promise, timerPromise])).rejects.toThrow(
        'Persistent error'
      )
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should respect shouldRetry function', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('400 Bad Request'))
      const shouldRetry = vi.fn().mockReturnValue(false)

      await expect(
        retryOperation(operation, { shouldRetry, maxAttempts: 3 })
      ).rejects.toThrow('400 Bad Request')

      expect(operation).toHaveBeenCalledTimes(1)
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1)
    })

    it('should call onRetry callback', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success')

      const onRetry = vi.fn()
      const promise = retryOperation(operation, { onRetry })

      await vi.runAllTimersAsync()
      await promise

      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1)
    })

    it('should use exponential backoff with max delay', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success')

      const promise = retryOperation(operation, {
        baseDelayMs: 100,
        maxDelayMs: 150
      })

      // First retry should be 100ms, second should be capped at 150ms (not 200ms)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(150)
      const result = await promise

      expect(result).toBe('success')
    })

    it('should handle non-Error objects', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce('string error')
        .mockRejectedValueOnce({ message: 'object error' })
        .mockResolvedValue('success')

      const promise = retryOperation(operation)

      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })
  })

  describe('retryOperationWithDetails', () => {
    it('should return detailed information about the retry operation', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success')

      const promise = retryOperationWithDetails(operation)

      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.result).toBe('success')
      expect(result.attempts).toBe(2)
      expect(result.totalTime).toBeGreaterThan(0)
    })
  })

  describe('defaultShouldRetry', () => {
    it('should not retry client errors (4xx)', () => {
      const clientErrors = [
        new Error('400 Bad Request'),
        new Error('401 Unauthorized'),
        new Error('403 Forbidden'),
        new Error('404 Not Found'),
        new Error('Invalid input'),
        new Error('Unauthorized access')
      ]

      clientErrors.forEach((error) => {
        expect(defaultShouldRetry(error, 1)).toBe(false)
      })
    })

    it('should retry network and server errors', () => {
      const retryableErrors = [
        new Error('Network connection failed'),
        new Error('Request timeout'),
        new Error('Connection refused'),
        new Error('500 Internal Server Error'),
        new Error('502 Bad Gateway'),
        new Error('503 Service Unavailable'),
        new Error('504 Gateway Timeout')
      ]

      retryableErrors.forEach((error) => {
        expect(defaultShouldRetry(error, 1)).toBe(true)
      })
    })

    it('should retry unknown errors by default', () => {
      const unknownErrors = [
        new Error('Something went wrong'),
        new Error('Unexpected error'),
        new Error('')
      ]

      unknownErrors.forEach((error) => {
        expect(defaultShouldRetry(error, 1)).toBe(true)
      })
    })
  })

  describe('createNetworkRetryStrategy', () => {
    it('should handle rate limiting', () => {
      const strategy = createNetworkRetryStrategy({})
      const rateLimitError = new Error('429 Too Many Requests')

      expect(strategy(rateLimitError, 1)).toBe(true)
    })

    it('should fall back to default strategy for other errors', () => {
      const strategy = createNetworkRetryStrategy({})
      const serverError = new Error('500 Internal Server Error')
      const clientError = new Error('400 Bad Request')

      expect(strategy(serverError, 1)).toBe(true)
      expect(strategy(clientError, 1)).toBe(false)
    })
  })

  describe('retryNetworkOperation', () => {
    it('should handle rate limiting with custom delay', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('429 Rate Limited'))
        .mockResolvedValue('success')

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const promise = retryNetworkOperation(operation, {
        rateLimitDelayMs: 1000
      })

      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('success')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limited')
      )

      consoleSpy.mockRestore()
    })

    it('should handle offline scenarios', async () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      const operation = vi.fn().mockRejectedValue(new Error('Network offline'))

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const promise = retryNetworkOperation(operation, { waitForOnline: true })

      // Run timers and properly handle the rejection
      const timerPromise = vi.runAllTimersAsync()
      await expect(Promise.all([promise, timerPromise])).rejects.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Network offline')
      )

      consoleSpy.mockRestore()

      // Restore navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })
    })
  })

  describe('createCustomRetryStrategy', () => {
    it('should respect retryable and non-retryable patterns', () => {
      const strategy = createCustomRetryStrategy(
        ['network', 'timeout'],
        ['400', '401']
      )

      expect(strategy(new Error('Network failure'), 1)).toBe(true)
      expect(strategy(new Error('Request timeout'), 1)).toBe(true)
      expect(strategy(new Error('400 Bad Request'), 1)).toBe(false)
      expect(strategy(new Error('401 Unauthorized'), 1)).toBe(false)
      expect(strategy(new Error('500 Server Error'), 1)).toBe(true) // Falls back to default
    })
  })

  describe('retryBatch', () => {
    it('should retry all operations and return all results', async () => {
      const operation1 = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('result1')

      const operation2 = vi.fn().mockResolvedValue('result2')

      const operation3 = vi
        .fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue('result3')

      const promise = retryBatch([operation1, operation2, operation3])

      await vi.runAllTimersAsync()
      const results = await promise

      expect(results).toEqual(['result1', 'result2', 'result3'])
    })

    it('should throw error with details when some operations fail permanently', async () => {
      const operation1 = vi.fn().mockResolvedValue('result1')
      const operation2 = vi.fn().mockRejectedValue(new Error('400 Bad Request')) // Won't retry
      const operation3 = vi.fn().mockResolvedValue('result3')

      const promise = retryBatch([operation1, operation2, operation3])

      // Run timers and properly handle the rejection
      const timerPromise = vi.runAllTimersAsync()
      await expect(Promise.all([promise, timerPromise])).rejects.toThrow(
        '1/3 operations failed'
      )
    })
  })

  describe('waitForOnline', () => {
    beforeEach(() => {
      vi.clearAllTimers()
      vi.useRealTimers() // Need real timers for event listeners
    })

    it('should resolve immediately if already online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })

      await expect(waitForOnline()).resolves.toBeUndefined()
    })

    it('should wait for online event', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      const promise = waitForOnline(1000)

      // Simulate network coming back online
      setTimeout(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: true
        })
        window.dispatchEvent(new Event('online'))
      }, 100)

      await expect(promise).resolves.toBeUndefined()
    })

    it('should timeout if network does not come online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      await expect(waitForOnline(100)).rejects.toThrow(
        'Network did not come online within 100ms'
      )
    })

    it('should handle server-side environment gracefully', async () => {
      const originalNavigator = globalThis.navigator
      // @ts-expect-error - Testing server-side behavior
      delete globalThis.navigator

      await expect(waitForOnline()).resolves.toBeUndefined()

      globalThis.navigator = originalNavigator
    })
  })

  describe('Error Handling Edge Cases', () => {
    it('should handle empty error messages', async () => {
      const operation = vi.fn().mockRejectedValue(new Error(''))

      const promise = retryOperation(operation, { maxAttempts: 2 })

      // Run timers and properly handle the rejection
      const timerPromise = vi.runAllTimersAsync()
      await expect(Promise.all([promise, timerPromise])).rejects.toThrow('')
    })

    it('should handle null/undefined errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(null)
        .mockRejectedValueOnce(undefined)
        .mockResolvedValue('success')

      const promise = retryOperation(operation)

      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('success')
    })
  })

  describe('Performance and Resource Management', () => {
    it('should not create excessive timers', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      await retryOperation(operation)

      // Should not create any timers for successful first attempt
      expect(vi.getTimerCount()).toBe(0)
    })

    it('should clean up timers properly on success', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue('success')

      const promise = retryOperation(operation)

      await vi.runAllTimersAsync()
      await promise

      // All timers should be cleaned up
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})

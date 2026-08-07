import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  pendingTopupNeedsRefresh,
  startTopupTracking,
  checkForCompletedTopup,
  clearTopupTracking
} from '@/platform/telemetry/topupTracker'
import type { AuditLog } from '@/services/customerEventsService'

// Mock telemetry
const mockTelemetry = vi.hoisted(() => ({
  trackApiCreditTopupSucceeded: vi.fn()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => mockTelemetry)
}))

describe('topupTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-07T12:00:00Z'))
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('startTopupTracking', () => {
    it('should save current timestamp to localStorage', () => {
      startTopupTracking()

      expect(localStorage.getItem('pending_topup_timestamp')).toBe(
        Date.now().toString()
      )
    })
  })

  describe('checkForCompletedTopup', () => {
    it('should return false if no pending topup exists', () => {
      const result = checkForCompletedTopup([])

      expect(result).toBe(false)
      expect(mockTelemetry.trackApiCreditTopupSucceeded).not.toHaveBeenCalled()
    })

    it('should return false if events array is empty', () => {
      localStorage.setItem('pending_topup_timestamp', Date.now().toString())

      const result = checkForCompletedTopup([])

      expect(result).toBe(false)
      expect(mockTelemetry.trackApiCreditTopupSucceeded).not.toHaveBeenCalled()
    })

    it('should return false if events array is null', () => {
      localStorage.setItem('pending_topup_timestamp', Date.now().toString())

      const result = checkForCompletedTopup(null)

      expect(result).toBe(false)
      expect(mockTelemetry.trackApiCreditTopupSucceeded).not.toHaveBeenCalled()
    })

    it('should auto-cleanup if timestamp is older than 24 hours', () => {
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
      localStorage.setItem('pending_topup_timestamp', oldTimestamp.toString())

      const events: AuditLog[] = [
        {
          event_id: 'test-1',
          event_type: 'credit_added',
          createdAt: new Date().toISOString(),
          params: { amount: 500 }
        }
      ]

      const result = checkForCompletedTopup(events)

      expect(result).toBe(false)
      expect(localStorage.getItem('pending_topup_timestamp')).toBeNull()
      expect(mockTelemetry.trackApiCreditTopupSucceeded).not.toHaveBeenCalled()
    })

    it('should detect completed topup and fire telemetry', () => {
      const startTimestamp = Date.now() - 5 * 60 * 1000 // 5 minutes ago
      localStorage.setItem('pending_topup_timestamp', startTimestamp.toString())

      const events: AuditLog[] = [
        {
          event_id: 'test-1',
          event_type: 'api_usage_completed',
          createdAt: new Date(startTimestamp - 1000).toISOString(),
          params: {}
        },
        {
          event_id: 'test-2',
          event_type: 'credit_added',
          createdAt: new Date(startTimestamp + 1000).toISOString(),
          params: { amount: 500 }
        }
      ]

      const result = checkForCompletedTopup(events)

      expect(result).toBe(true)
      expect(mockTelemetry.trackApiCreditTopupSucceeded).toHaveBeenCalledOnce()
      expect(localStorage.getItem('pending_topup_timestamp')).toBeNull()
    })

    it('should not detect topup if credit_added event is before tracking started', () => {
      const startTimestamp = Date.now()
      localStorage.setItem('pending_topup_timestamp', startTimestamp.toString())

      const events: AuditLog[] = [
        {
          event_id: 'test-1',
          event_type: 'credit_added',
          createdAt: new Date(startTimestamp - 1000).toISOString(), // Before tracking
          params: { amount: 500 }
        }
      ]

      const result = checkForCompletedTopup(events)

      expect(result).toBe(false)
      expect(mockTelemetry.trackApiCreditTopupSucceeded).not.toHaveBeenCalled()
      expect(localStorage.getItem('pending_topup_timestamp')).toBe(
        startTimestamp.toString()
      )
    })

    it('should ignore events without createdAt timestamp', () => {
      const startTimestamp = Date.now()
      localStorage.setItem('pending_topup_timestamp', startTimestamp.toString())

      const events: AuditLog[] = [
        {
          event_id: 'test-1',
          event_type: 'credit_added',
          createdAt: undefined,
          params: { amount: 500 }
        }
      ]

      const result = checkForCompletedTopup(events)

      expect(result).toBe(false)
      expect(mockTelemetry.trackApiCreditTopupSucceeded).not.toHaveBeenCalled()
    })

    it('should only match credit_added events, not other event types', () => {
      const startTimestamp = Date.now()
      localStorage.setItem('pending_topup_timestamp', startTimestamp.toString())

      const events: AuditLog[] = [
        {
          event_id: 'test-1',
          event_type: 'api_usage_completed',
          createdAt: new Date(startTimestamp + 1000).toISOString(),
          params: {}
        },
        {
          event_id: 'test-2',
          event_type: 'account_created',
          createdAt: new Date(startTimestamp + 2000).toISOString(),
          params: {}
        }
      ]

      const result = checkForCompletedTopup(events)

      expect(result).toBe(false)
      expect(mockTelemetry.trackApiCreditTopupSucceeded).not.toHaveBeenCalled()
    })
  })

  describe('clearTopupTracking', () => {
    it('should remove pending topup from localStorage', () => {
      clearTopupTracking()

      expect(localStorage.getItem('pending_topup_timestamp')).toBeNull()
    })
  })

  describe('pendingTopupNeedsRefresh', () => {
    it('returns false and clears nothing when no marker exists', () => {
      expect(pendingTopupNeedsRefresh()).toBe(false)
      expect(localStorage.getItem('pending_topup_timestamp')).toBeNull()
    })

    it('keeps a fresh marker available across focus events', () => {
      const timestamp = (Date.now() - 5 * 60 * 1000).toString()
      localStorage.setItem('pending_topup_timestamp', timestamp)

      expect(pendingTopupNeedsRefresh()).toBe(true)
      expect(pendingTopupNeedsRefresh()).toBe(true)
      expect(localStorage.getItem('pending_topup_timestamp')).toBe(timestamp)
    })

    it('clears and returns false for a marker older than 24 hours', () => {
      localStorage.setItem(
        'pending_topup_timestamp',
        (Date.now() - 25 * 60 * 60 * 1000).toString()
      )

      expect(pendingTopupNeedsRefresh()).toBe(false)
      expect(localStorage.getItem('pending_topup_timestamp')).toBeNull()
    })

    it.for(['invalid', Number.MAX_SAFE_INTEGER.toString()])(
      'clears and returns false for an invalid marker: %s',
      (timestamp) => {
        localStorage.setItem('pending_topup_timestamp', timestamp)

        expect(pendingTopupNeedsRefresh()).toBe(false)
        expect(localStorage.getItem('pending_topup_timestamp')).toBeNull()
      }
    )
  })
})

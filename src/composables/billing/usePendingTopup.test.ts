import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AuditLog } from '@/services/customerEventsService'

import { usePendingTopup } from './usePendingTopup'

const STORAGE_KEY = 'pending_topup_timestamp'

function creditAddedEvent(atMs: number): AuditLog {
  return {
    event_type: 'credit_added',
    createdAt: new Date(atMs).toISOString()
  } as AuditLog
}

describe('usePendingTopup', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('startPendingTopup writes the marker; pendingTopupNeedsRefresh reflects it', () => {
    const { startPendingTopup, pendingTopupNeedsRefresh } = usePendingTopup()
    expect(pendingTopupNeedsRefresh()).toBe(false)
    startPendingTopup()
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(pendingTopupNeedsRefresh()).toBe(true)
  })

  it('pendingTopupNeedsRefresh is false and clears an expired marker', () => {
    const { pendingTopupNeedsRefresh } = usePendingTopup()
    localStorage.setItem(
      STORAGE_KEY,
      String(Date.now() - (24 * 60 * 60 * 1000 + 1000))
    )
    expect(pendingTopupNeedsRefresh()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('pendingTopupNeedsRefresh clears an unparseable marker', () => {
    const { pendingTopupNeedsRefresh } = usePendingTopup()
    localStorage.setItem(STORAGE_KEY, 'not-a-number')
    expect(pendingTopupNeedsRefresh()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('pendingTopupNeedsRefresh clears an empty marker', () => {
    const { pendingTopupNeedsRefresh } = usePendingTopup()
    localStorage.setItem(STORAGE_KEY, '')
    expect(pendingTopupNeedsRefresh()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  describe('isPendingTopupCompleted', () => {
    it('is false when no marker is set', () => {
      const { isPendingTopupCompleted } = usePendingTopup()
      expect(isPendingTopupCompleted([creditAddedEvent(Date.now())])).toBe(
        false
      )
    })

    it('is false when there are no events', () => {
      const { startPendingTopup, isPendingTopupCompleted } = usePendingTopup()
      startPendingTopup()
      expect(isPendingTopupCompleted([])).toBe(false)
      expect(isPendingTopupCompleted(null)).toBe(false)
    })

    it('is true and clears the marker when a credit_added event lands after tracking', () => {
      const { startPendingTopup, isPendingTopupCompleted } = usePendingTopup()
      startPendingTopup()
      expect(
        isPendingTopupCompleted([creditAddedEvent(Date.now() + 1000)])
      ).toBe(true)
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('ignores credit events that predate tracking', () => {
      const { startPendingTopup, isPendingTopupCompleted } = usePendingTopup()
      startPendingTopup()
      expect(
        isPendingTopupCompleted([creditAddedEvent(Date.now() - 60_000)])
      ).toBe(false)
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    })
  })

  it('clearPendingTopup removes the marker', () => {
    const { startPendingTopup, clearPendingTopup, pendingTopupNeedsRefresh } =
      usePendingTopup()
    startPendingTopup()
    clearPendingTopup()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(pendingTopupNeedsRefresh()).toBe(false)
  })
})

/**
 * @fileoverview Tests for job list reconciliation
 */
import { describe, expect, it } from 'vitest'

import { reconcileJobs } from '@/platform/remote/comfyui/history/reconciliation'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

function createJob(id: string, createTime = 0, priority?: number): JobListItem {
  return {
    id,
    status: 'completed',
    create_time: createTime,
    priority: priority ?? createTime
  }
}

function getAllIds(result: JobListItem[]): string[] {
  return result.map((item) => item.id)
}

describe('reconcileJobs', () => {
  describe('when processing server items', () => {
    it('should return all server items', () => {
      const serverHistory = [createJob('item-1', 10), createJob('item-2', 5)]

      const result = reconcileJobs(serverHistory, 10)

      const ids = getAllIds(result)
      expect(ids).toHaveLength(2)
      expect(ids).toContain('item-1')
      expect(ids).toContain('item-2')
    })

    it('should sort by create_time descending', () => {
      const serverHistory = [
        createJob('low', 10),
        createJob('high', 20),
        createJob('mid', 15)
      ]

      const result = reconcileJobs(serverHistory, 10)

      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('high')
      expect(result[1].id).toBe('mid')
      expect(result[2].id).toBe('low')
    })
  })

  describe('when limiting the result count', () => {
    it('should respect the maxItems constraint', () => {
      const serverHistory = Array.from({ length: 10 }, (_, i) =>
        createJob(`item-${i}`, 100 - i)
      )

      const result = reconcileJobs(serverHistory, 5)

      expect(result).toHaveLength(5)
    })

    it('should keep most recent items when exceeding capacity', () => {
      const serverHistory = [
        createJob('recent', 30),
        createJob('medium', 20),
        createJob('old', 10)
      ]

      const result = reconcileJobs(serverHistory, 2)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('recent')
      expect(result[1].id).toBe('medium')
    })
  })

  describe('when handling empty collections', () => {
    it('should return all server items up to maxItems', () => {
      const serverHistory = [createJob('item-1', 10), createJob('item-2', 5)]

      const result = reconcileJobs(serverHistory, 10)

      expect(result).toHaveLength(2)
    })

    it('should return empty result when server history is empty', () => {
      const result = reconcileJobs([], 10)

      expect(result).toHaveLength(0)
    })
  })
})

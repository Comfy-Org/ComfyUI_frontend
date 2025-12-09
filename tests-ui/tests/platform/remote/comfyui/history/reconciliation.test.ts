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
  describe('when adding new items from server', () => {
    it('should retain items with IDs not present in client history', () => {
      const serverHistory = [
        createJob('new-item', 10),
        createJob('existing-item', 5)
      ]
      const clientHistory = [createJob('existing-item', 5)]

      const result = reconcileJobs(serverHistory, clientHistory, 10)

      const ids = getAllIds(result)
      expect(ids).toHaveLength(2)
      expect(ids).toContain('new-item')
      expect(ids).toContain('existing-item')
    })

    it('should respect create_time ordering when adding multiple new items', () => {
      const serverHistory = [
        createJob('new-1', 20),
        createJob('new-2', 15),
        createJob('existing', 10)
      ]
      const clientHistory = [createJob('existing', 10)]

      const result = reconcileJobs(serverHistory, clientHistory, 10)

      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('new-1')
      expect(result[1].id).toBe('new-2')
      expect(result[2].id).toBe('existing')
    })
  })

  describe('when reconciling with existing client items', () => {
    it('should retain client items that still exist on server', () => {
      const serverHistory = [createJob('item-1', 10), createJob('item-2', 5)]
      const clientHistory = [createJob('item-1', 10), createJob('item-2', 5)]

      const result = reconcileJobs(serverHistory, clientHistory, 10)

      const ids = getAllIds(result)
      expect(ids).toHaveLength(2)
      expect(ids).toContain('item-1')
      expect(ids).toContain('item-2')
    })

    it('should evict client items that no longer exist on server', () => {
      const serverHistory = [createJob('item-1', 10)]
      const clientHistory = [createJob('item-1', 10), createJob('old-item', 5)]

      const result = reconcileJobs(serverHistory, clientHistory, 10)

      const ids = getAllIds(result)
      expect(ids).toHaveLength(1)
      expect(ids).toContain('item-1')
      expect(ids).not.toContain('old-item')
    })
  })

  describe('when limiting the result count', () => {
    it('should respect the maxItems constraint', () => {
      const serverHistory = Array.from({ length: 10 }, (_, i) =>
        createJob(`item-${i}`, 100 - i)
      )

      const result = reconcileJobs(serverHistory, [], 5)

      expect(result).toHaveLength(5)
    })

    it('should evict lowest priority items when exceeding capacity', () => {
      const serverHistory = [
        createJob('high', 30),
        createJob('medium', 20),
        createJob('low', 10)
      ]

      const result = reconcileJobs(serverHistory, [], 2)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('high')
      expect(result[1].id).toBe('medium')
    })
  })

  describe('when handling empty collections', () => {
    it('should return all server items when client history is empty', () => {
      const serverHistory = [createJob('item-1', 10), createJob('item-2', 5)]

      const result = reconcileJobs(serverHistory, [], 10)

      expect(result).toHaveLength(2)
    })

    it('should return empty result when server history is empty', () => {
      const clientHistory = [createJob('item-1', 10)]

      const result = reconcileJobs([], clientHistory, 10)

      expect(result).toHaveLength(0)
    })

    it('should return empty result when both collections are empty', () => {
      const result = reconcileJobs([], [], 10)

      expect(result).toHaveLength(0)
    })
  })
})

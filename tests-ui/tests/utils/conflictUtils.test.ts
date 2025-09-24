import { describe, expect, it } from 'vitest'

import type {
  ConflictDetail,
  ConflictDetectionResult
} from '@/types/conflictDetectionTypes'
import {
  consolidateConflictsByPackage,
  createBannedConflict,
  createPendingConflict,
  generateConflictSummary
} from '@/utils/conflictUtils'

describe('conflictUtils', () => {
  describe('createBannedConflict', () => {
    it('should return banned conflict when isBanned is true', () => {
      const result = createBannedConflict(true)
      expect(result).toEqual({
        type: 'banned',
        current_value: 'installed',
        required_value: 'not_banned'
      })
    })

    it('should return null when isBanned is false', () => {
      const result = createBannedConflict(false)
      expect(result).toBeNull()
    })

    it('should return null when isBanned is undefined', () => {
      const result = createBannedConflict(undefined)
      expect(result).toBeNull()
    })
  })

  describe('createPendingConflict', () => {
    it('should return pending conflict when isPending is true', () => {
      const result = createPendingConflict(true)
      expect(result).toEqual({
        type: 'pending',
        current_value: 'installed',
        required_value: 'not_pending'
      })
    })

    it('should return null when isPending is false', () => {
      const result = createPendingConflict(false)
      expect(result).toBeNull()
    })

    it('should return null when isPending is undefined', () => {
      const result = createPendingConflict(undefined)
      expect(result).toBeNull()
    })
  })

  describe('consolidateConflictsByPackage', () => {
    it('should group conflicts by normalized package name', () => {
      const conflicts: ConflictDetectionResult[] = [
        {
          package_name: 'mypack@1_0_3',
          package_id: 'mypack@1_0_3',
          conflicts: [
            { type: 'os', current_value: 'Windows', required_value: 'Linux' }
          ],
          has_conflict: true,
          is_compatible: false
        },
        {
          package_name: 'mypack',
          package_id: 'mypack',
          conflicts: [
            {
              type: 'comfyui_version',
              current_value: '1.0.0',
              required_value: '>=2.0.0'
            }
          ],
          has_conflict: true,
          is_compatible: false
        }
      ]

      const result = consolidateConflictsByPackage(conflicts)

      expect(result).toHaveLength(1)
      expect(result[0].package_name).toBe('mypack')
      expect(result[0].conflicts).toHaveLength(2)
      expect(result[0].has_conflict).toBe(true)
      expect(result[0].is_compatible).toBe(false)
    })

    it('should deduplicate identical conflicts', () => {
      const duplicateConflict: ConflictDetail = {
        type: 'os',
        current_value: 'Windows',
        required_value: 'Linux'
      }

      const conflicts: ConflictDetectionResult[] = [
        {
          package_name: 'pack',
          package_id: 'pack',
          conflicts: [duplicateConflict],
          has_conflict: true,
          is_compatible: false
        },
        {
          package_name: 'pack@version',
          package_id: 'pack@version',
          conflicts: [duplicateConflict],
          has_conflict: true,
          is_compatible: false
        }
      ]

      const result = consolidateConflictsByPackage(conflicts)

      expect(result).toHaveLength(1)
      expect(result[0].conflicts).toHaveLength(1)
    })

    it('should handle packages without conflicts', () => {
      const conflicts: ConflictDetectionResult[] = [
        {
          package_name: 'compatible-pack',
          package_id: 'compatible-pack',
          conflicts: [],
          has_conflict: false,
          is_compatible: true
        }
      ]

      const result = consolidateConflictsByPackage(conflicts)

      expect(result).toHaveLength(1)
      expect(result[0].conflicts).toHaveLength(0)
      expect(result[0].has_conflict).toBe(false)
      expect(result[0].is_compatible).toBe(true)
    })

    it('should handle empty input', () => {
      const result = consolidateConflictsByPackage([])
      expect(result).toEqual([])
    })

    it('should merge conflicts from multiple versions of same package', () => {
      const conflicts: ConflictDetectionResult[] = [
        {
          package_name: 'mynode@1_0_0',
          package_id: 'mynode@1_0_0',
          conflicts: [
            { type: 'os', current_value: 'Windows', required_value: 'Linux' }
          ],
          has_conflict: true,
          is_compatible: false
        },
        {
          package_name: 'mynode@2_0_0',
          package_id: 'mynode@2_0_0',
          conflicts: [
            {
              type: 'accelerator',
              current_value: 'CPU',
              required_value: 'CUDA'
            }
          ],
          has_conflict: true,
          is_compatible: false
        },
        {
          package_name: 'mynode',
          package_id: 'mynode',
          conflicts: [
            {
              type: 'comfyui_version',
              current_value: '1.0.0',
              required_value: '>=2.0.0'
            }
          ],
          has_conflict: true,
          is_compatible: false
        }
      ]

      const result = consolidateConflictsByPackage(conflicts)

      expect(result).toHaveLength(1)
      expect(result[0].package_name).toBe('mynode')
      expect(result[0].conflicts).toHaveLength(3)
      expect(result[0].conflicts).toContainEqual({
        type: 'os',
        current_value: 'Windows',
        required_value: 'Linux'
      })
      expect(result[0].conflicts).toContainEqual({
        type: 'accelerator',
        current_value: 'CPU',
        required_value: 'CUDA'
      })
      expect(result[0].conflicts).toContainEqual({
        type: 'comfyui_version',
        current_value: '1.0.0',
        required_value: '>=2.0.0'
      })
    })
  })

  describe('generateConflictSummary', () => {
    it('should generate correct summary for results with conflicts', () => {
      const results: ConflictDetectionResult[] = [
        {
          package_name: 'pack1',
          package_id: 'pack1',
          conflicts: [
            { type: 'os', current_value: 'Windows', required_value: 'Linux' }
          ],
          has_conflict: true,
          is_compatible: false
        },
        {
          package_name: 'pack2',
          package_id: 'pack2',
          conflicts: [],
          has_conflict: false,
          is_compatible: true
        },
        {
          package_name: 'pack3',
          package_id: 'pack3',
          conflicts: [
            {
              type: 'banned',
              current_value: 'installed',
              required_value: 'not_banned'
            }
          ],
          has_conflict: true,
          is_compatible: false
        }
      ]

      const durationMs = 1500
      const summary = generateConflictSummary(results, durationMs)

      expect(summary.total_packages).toBe(3)
      expect(summary.compatible_packages).toBe(1)
      expect(summary.conflicted_packages).toBe(2)
      expect(summary.banned_packages).toBe(0) // Note: The current implementation doesn't populate these
      expect(summary.pending_packages).toBe(0)
      expect(summary.check_duration_ms).toBe(1500)
      expect(summary.last_check_timestamp).toBeDefined()
      expect(summary.conflicts_by_type_details).toBeDefined()
    })

    it('should handle empty results', () => {
      const summary = generateConflictSummary([], 100)

      expect(summary.total_packages).toBe(0)
      expect(summary.compatible_packages).toBe(0)
      expect(summary.conflicted_packages).toBe(0)
      expect(summary.banned_packages).toBe(0)
      expect(summary.pending_packages).toBe(0)
      expect(summary.check_duration_ms).toBe(100)
    })

    it('should generate ISO timestamp', () => {
      const summary = generateConflictSummary([], 0)
      const timestamp = new Date(summary.last_check_timestamp)
      expect(timestamp).toBeInstanceOf(Date)
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('should handle all compatible packages', () => {
      const results: ConflictDetectionResult[] = [
        {
          package_name: 'pack1',
          package_id: 'pack1',
          conflicts: [],
          has_conflict: false,
          is_compatible: true
        },
        {
          package_name: 'pack2',
          package_id: 'pack2',
          conflicts: [],
          has_conflict: false,
          is_compatible: true
        }
      ]

      const summary = generateConflictSummary(results, 500)

      expect(summary.total_packages).toBe(2)
      expect(summary.compatible_packages).toBe(2)
      expect(summary.conflicted_packages).toBe(0)
    })
  })
})

import { describe, expect, it } from 'vitest'

import type {
  ConflictDetail,
  ConflictDetectionResult
} from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import {
  consolidateConflictsByPackage,
  createBannedConflict,
  createPendingConflict,
  evaluateCompatibility
} from '@/workbench/extensions/manager/utils/conflictUtils'

describe('conflictUtils', () => {
  describe('evaluateCompatibility', () => {
    const incompatibleEnv = {
      comfyui_version: '0.3.0',
      frontend_version: '1.0.0',
      os: 'darwin',
      accelerator: 'mps'
    }

    it('emits conflicts in canonical order when all six checks fail', () => {
      const conflicts = evaluateCompatibility(
        {
          supported_comfyui_version: '>=1.0.0',
          supported_comfyui_frontend_version: '>=2.0.0',
          supported_os: ['Linux'],
          supported_accelerators: ['CUDA'],
          isBanned: true,
          isPending: true
        },
        incompatibleEnv
      )

      expect(conflicts.map((conflict) => conflict.type)).toEqual([
        'comfyui_version',
        'frontend_version',
        'os',
        'accelerator',
        'banned',
        'pending'
      ])
    })

    it('adds a banned conflict only when isBanned is true', () => {
      const compatibleInput = {
        supported_comfyui_version: undefined,
        supported_comfyui_frontend_version: undefined,
        supported_os: undefined,
        supported_accelerators: undefined,
        isPending: false
      }

      const withoutBan = evaluateCompatibility(
        { ...compatibleInput, isBanned: false },
        incompatibleEnv
      )
      expect(withoutBan).toEqual([])

      const withBan = evaluateCompatibility(
        { ...compatibleInput, isBanned: true },
        incompatibleEnv
      )
      expect(withBan).toEqual([
        {
          type: 'banned',
          current_value: 'installed',
          required_value: 'not_banned'
        }
      ])
    })

    it('reports no conflicts for an unconstrained package when the system environment has not loaded yet', () => {
      // Version checks treat a nil current version as compatible; OS/accelerator
      // checks treat a nil supported list as "all supported". Together these mean
      // a package with no declared constraints never conflicts, even before
      // systemEnvironment has loaded.
      const conflicts = evaluateCompatibility(
        {
          supported_comfyui_version: undefined,
          supported_comfyui_frontend_version: undefined,
          supported_os: undefined,
          supported_accelerators: undefined,
          isBanned: false,
          isPending: false
        },
        {
          comfyui_version: undefined,
          frontend_version: undefined,
          os: undefined,
          accelerator: undefined
        }
      )

      expect(conflicts).toEqual([])
    })

    it('reports OS/accelerator conflicts when a package declares constraints but the environment has not loaded yet', () => {
      // An unknown current OS/accelerator does NOT satisfy a declared
      // supported list, so a package with real constraints appears
      // incompatible (not compatible) before systemEnvironment has loaded.
      const conflicts = evaluateCompatibility(
        {
          supported_comfyui_version: undefined,
          supported_comfyui_frontend_version: undefined,
          supported_os: ['Linux'],
          supported_accelerators: ['CUDA'],
          isBanned: false,
          isPending: false
        },
        {
          comfyui_version: undefined,
          frontend_version: undefined,
          os: undefined,
          accelerator: undefined
        }
      )

      expect(conflicts.map((c) => c.type)).toEqual(['os', 'accelerator'])
    })
  })

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
})

import { groupBy, uniqBy } from 'es-toolkit/compat'

import { normalizePackId } from '@/utils/packUtils'
import type {
  RegistryAccelerator,
  RegistryOS
} from '@/workbench/extensions/manager/types/compatibility.types'
import type {
  ConflictDetail,
  ConflictDetectionResult,
  SystemEnvironment
} from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import {
  checkAcceleratorCompatibility,
  checkOSCompatibility
} from '@/workbench/extensions/manager/utils/systemCompatibility'
import { checkVersionCompatibility } from '@/workbench/extensions/manager/utils/versionUtil'

/**
 * Checks for banned package status conflicts.
 */
export function createBannedConflict(
  isBanned?: boolean
): ConflictDetail | null {
  if (isBanned === true) {
    return {
      type: 'banned',
      current_value: 'installed',
      required_value: 'not_banned'
    }
  }
  return null
}

/**
 * Checks for pending package status conflicts.
 */
export function createPendingConflict(
  isPending?: boolean
): ConflictDetail | null {
  if (isPending === true) {
    return {
      type: 'pending',
      current_value: 'installed',
      required_value: 'not_pending'
    }
  }
  return null
}

/**
 * Single source of truth for mapping a Node/NodeVersion status string to
 * banned/pending booleans. NodeStatusBanned is a Node-only value; NodeVersion
 * has no pending-equivalent Node status, so isPending only checks the
 * NodeVersion enum.
 */
export function deriveStatusFlags(status?: string): {
  isBanned: boolean
  isPending: boolean
} {
  return {
    isBanned:
      status === 'NodeStatusBanned' || status === 'NodeVersionStatusBanned',
    isPending: status === 'NodeVersionStatusPending'
  }
}

/**
 * Normalized compatibility inputs for a single package, produced by each call
 * site from its own source shape. Banned/pending are pre-derived booleans
 * (see {@link deriveStatusFlags}) since the two callers read status from
 * different source shapes (Node vs NodeVersion).
 */
export interface CompatibilityInput {
  supported_os?: RegistryOS[]
  supported_accelerators?: RegistryAccelerator[]
  supported_comfyui_version?: string
  supported_comfyui_frontend_version?: string
  isBanned: boolean
  isPending: boolean
}

/**
 * Runs the six compatibility leaf checks and collects the conflicts that fire.
 *
 * Canonical order = comfyui_version → frontend_version → OS → accelerator →
 * banned → pending; every consumer filters conflicts by `.type`, so the order
 * is cosmetic only.
 */
export function evaluateCompatibility(
  input: CompatibilityInput,
  env: SystemEnvironment
): ConflictDetail[] {
  const conflicts: ConflictDetail[] = []

  const versionConflict = checkVersionCompatibility(
    'comfyui_version',
    env.comfyui_version,
    input.supported_comfyui_version
  )
  if (versionConflict) conflicts.push(versionConflict)

  const frontendConflict = checkVersionCompatibility(
    'frontend_version',
    env.frontend_version,
    input.supported_comfyui_frontend_version
  )
  if (frontendConflict) conflicts.push(frontendConflict)

  const osConflict = checkOSCompatibility(input.supported_os, env.os)
  if (osConflict) conflicts.push(osConflict)

  const acceleratorConflict = checkAcceleratorCompatibility(
    input.supported_accelerators,
    env.accelerator
  )
  if (acceleratorConflict) conflicts.push(acceleratorConflict)

  const bannedConflict = createBannedConflict(input.isBanned)
  if (bannedConflict) conflicts.push(bannedConflict)

  const pendingConflict = createPendingConflict(input.isPending)
  if (pendingConflict) conflicts.push(pendingConflict)

  return conflicts
}

/**
 * Groups and deduplicates conflicts by normalized package name.
 * Consolidates multiple conflict sources (registry checks, import failures, disabled packages with version suffix)
 * into a single UI entry per package.
 *
 * Example:
 * - Input: [{name: "pack@1_0_3", conflicts: [...]}, {name: "pack", conflicts: [...]}]
 * - Output: [{name: "pack", conflicts: [...combined unique conflicts...]}]
 *
 * @param conflicts Array of conflict detection results (may have duplicate packages with version suffixes)
 * @returns Array of deduplicated conflict results grouped by normalized package name
 */
export function consolidateConflictsByPackage(
  conflicts: ConflictDetectionResult[]
): ConflictDetectionResult[] {
  // Group conflicts by normalized package name using es-toolkit
  const grouped = groupBy(conflicts, (conflict) =>
    normalizePackId(conflict.package_name)
  )

  // Merge conflicts for each group
  return Object.entries(grouped).map(([packageName, packageConflicts]) => {
    // Flatten all conflicts from the group
    const allConflicts = packageConflicts.flatMap((pc) => pc.conflicts)

    // Remove duplicate conflicts using uniqBy
    const uniqueConflicts = uniqBy(
      allConflicts,
      (conflict) =>
        `${conflict.type}|${conflict.current_value}|${conflict.required_value}`
    )

    // Use the first item as base and update with merged data
    const baseItem = packageConflicts[0]
    return {
      ...baseItem,
      package_name: packageName, // Use normalized name
      conflicts: uniqueConflicts,
      has_conflict: uniqueConflicts.length > 0,
      is_compatible: uniqueConflicts.length === 0
    }
  })
}

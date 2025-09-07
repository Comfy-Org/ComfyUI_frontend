import { isEmpty, isNil } from 'es-toolkit/compat'
import { clean, satisfies } from 'semver'

import config from '@/config'
import type {
  ConflictDetail,
  ConflictType
} from '@/types/conflictDetectionTypes'

/**
 * Cleans a version string by removing common prefixes and normalizing format
 * @param version Raw version string (e.g., "v1.2.3", "1.2.3-alpha")
 * @returns Cleaned version string or original if cleaning fails
 */
export function cleanVersion(version: string): string {
  return clean(version) || version
}

/**
 * Checks if a version satisfies a version range
 * @param version Current version
 * @param range Version range (e.g., ">=1.0.0", "^1.2.0", "1.0.0 - 2.0.0")
 * @returns true if version satisfies the range
 */
export function satisfiesVersion(version: string, range: string): boolean {
  try {
    const cleanedVersion = cleanVersion(version)
    return satisfies(cleanedVersion, range)
  } catch {
    return false
  }
}

/**
 * Checks version compatibility and returns conflict details.
 * Supports all semver ranges including >=, <=, >, <, ~, ^ operators.
 * @param type Conflict type (e.g., 'comfyui_version', 'frontend_version')
 * @param currentVersion Current version string
 * @param supportedVersion Required version range string
 * @returns ConflictDetail object if incompatible, null if compatible
 */
export function checkVersionCompatibility(
  type: ConflictType,
  currentVersion?: string,
  supportedVersion?: string
): ConflictDetail | null {
  // Use es-toolkit for null/empty checks
  if (isNil(currentVersion) || isEmpty(currentVersion)) {
    return null
  }

  // Use es-toolkit for supported version validation
  if (isNil(supportedVersion) || isEmpty(supportedVersion?.trim())) {
    return null
  }

  // Clean and check version compatibility
  const cleanCurrent = cleanVersion(currentVersion ?? '')
  const isCompatible = satisfiesVersion(cleanCurrent, supportedVersion ?? '')

  if (isCompatible) return null

  return {
    type,
    current_value: currentVersion ?? '',
    required_value: supportedVersion ?? ''
  }
}

/**
 * get frontend version from config.
 * @returns frontend version string or undefined
 */
export function getFrontendVersion(): string | undefined {
  return config.app_version || import.meta.env.VITE_APP_VERSION || undefined
}

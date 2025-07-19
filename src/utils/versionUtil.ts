import * as semver from 'semver'

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
  return semver.clean(version) || version
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
    return semver.satisfies(cleanedVersion, range)
  } catch {
    return false
  }
}

/**
 * Compares two versions and returns the difference type
 * @param version1 First version
 * @param version2 Second version
 * @returns Difference type or null if comparison fails
 */
export function getVersionDifference(
  version1: string,
  version2: string
): semver.ReleaseType | null {
  try {
    const clean1 = cleanVersion(version1)
    const clean2 = cleanVersion(version2)
    return semver.diff(clean1, clean2)
  } catch {
    return null
  }
}

/**
 * Checks if a version is valid according to semver
 * @param version Version string to validate
 * @returns true if version is valid
 */
export function isValidVersion(version: string): boolean {
  return semver.valid(version) !== null
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
  currentVersion: string,
  supportedVersion: string
): ConflictDetail | null {
  // If current version is unknown, assume compatible (no conflict)
  if (!currentVersion || currentVersion === 'unknown') {
    return null
  }

  // If no version requirement specified, assume compatible (no conflict)
  if (!supportedVersion || supportedVersion.trim() === '') {
    return null
  }

  try {
    // Clean the current version using semver utilities
    const cleanCurrent = cleanVersion(currentVersion)

    // Check version compatibility using semver library
    const isCompatible = satisfiesVersion(cleanCurrent, supportedVersion)

    if (!isCompatible) {
      return {
        type,
        current_value: currentVersion,
        required_value: supportedVersion
      }
    }

    return null
  } catch (error) {
    console.warn(
      `[VersionUtil] Failed to parse version requirement: ${supportedVersion}`,
      error
    )
    // On error, assume incompatible to be safe
    return {
      type,
      current_value: currentVersion,
      required_value: supportedVersion
    }
  }
}

import { coerce, valid } from 'semver'

/**
 * Validates if a string is a valid semantic version.
 * @param version The version string to validate
 * @returns true if the version is a valid semver, false otherwise
 */
export function isValidSemver(version: string): boolean {
  return !!valid(version)
}

/**
 * Checks if a version string is a Git hash (not a semantic version).
 * Git hashes are typically 7-40 characters of hexadecimal.
 * @param version The version string to check
 * @returns true if the version appears to be a Git hash, false otherwise
 */
export function isGitHash(version: string): boolean {
  // Check if it's NOT a valid semver and matches git hash pattern
  if (isValidSemver(version)) {
    return false
  }

  // Git hash pattern: 7-40 hexadecimal characters
  const gitHashPattern = /^[0-9a-f]{7,40}$/i
  return gitHashPattern.test(version)
}

/**
 * Coerces a version string to a valid semver version with a fallback.
 * @param version The version string to coerce
 * @param fallback The fallback version if coercion fails (default: '0.0.0')
 * @returns A valid semver version string
 */
export function coerceVersion(
  version: string | undefined,
  fallback = '0.0.0'
): string {
  if (!version) return fallback
  const coerced = coerce(version)
  return coerced ? coerced.version : fallback
}

/**
 * Determines if a version string represents a nightly/development version.
 * This includes Git hashes and any non-semver version strings.
 * @param version The version string to check
 * @returns true if the version is a nightly/development version
 */
export function isNightlyVersion(version: string): boolean {
  return !isValidSemver(version)
}

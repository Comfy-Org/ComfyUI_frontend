/** Pattern to match SHA256 hash-based filenames (64 hex chars + extension) */
export const SHA256_HASH_FILENAME_PATTERN = /^[a-f0-9]{64}\./i

/**
 * Check if a filename matches SHA256 hash pattern
 * @param filename The filename to check
 * @returns True if filename is a SHA256 hash-based filename
 */
export function isHashFilename(filename: string): boolean {
  return SHA256_HASH_FILENAME_PATTERN.test(filename)
}

/**
 * Check if an array of options contains any hash filenames
 * @param options Array of option values to check
 * @returns True if any option is a hash filename
 */
export function hasHashFilenames(options: (string | number)[]): boolean {
  return options.some(
    (opt) => typeof opt === 'string' && SHA256_HASH_FILENAME_PATTERN.test(opt)
  )
}

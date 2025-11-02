/**
 * Utility functions for widget option handling
 */

/**
 * Ensures the current value is included in the options array.
 * This preserves legacy behavior where deserialized workflow values
 * can be shown even if they're not in the current options list
 * (e.g., deleted models, removed files, etc.)
 *
 * @param options - The available options from widget.options.values
 * @param currentValue - The current widget value
 * @returns Options array with current value prepended if missing
 */
export function ensureValueInOptions<T extends string | number>(
  options: readonly T[],
  currentValue: T | undefined | null
): T[] {
  // Early return for empty/null values
  if (currentValue == null || currentValue === '') {
    return [...options]
  }

  // If value already exists, return original options
  if (options.includes(currentValue)) {
    return [...options]
  }

  // Prepend missing value to options
  return [currentValue, ...options]
}

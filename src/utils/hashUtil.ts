/**
 * FNV-1a hash function for creating short, deterministic keys from strings.
 *
 * FNV-1a is chosen for its simplicity, speed, and good distribution properties.
 * It is not cryptographic: use it for keying and grouping, never for secrets.
 *
 * @param str - The string to hash
 * @returns A 32-bit unsigned integer hash
 */
export function fnv1a(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Creates an 8-character hex digest of a string using FNV-1a.
 *
 * Callers persist this output — see `hashPath`, which keys unsaved workflow
 * drafts by it — so the digest of a given string must not change.
 *
 * @param str - The string to hash
 * @returns An 8-character hex string
 *
 * @example
 * fnv1aHex("workflows/Untitled.json") // "325d5d45"
 */
export function fnv1aHex(str: string): string {
  return fnv1a(str).toString(16).padStart(8, '0')
}

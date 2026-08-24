import { fnv1aHex } from '@/utils/hashUtil'

/**
 * Creates an 8-character hex key from a workflow path using FNV-1a hash.
 *
 * Stored drafts are keyed by this value, so changing the digest orphans every
 * draft a user has not saved yet.
 *
 * @param path - The workflow path (e.g., "workflows/My Workflow.json")
 * @returns An 8-character hex string (e.g., "a1b2c3d4")
 *
 * @example
 * hashPath("workflows/Untitled.json") // "1a2b3c4d"
 */
export function hashPath(path: string): string {
  return fnv1aHex(path)
}

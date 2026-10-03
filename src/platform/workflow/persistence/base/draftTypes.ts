import type { StorageScope } from './storageKeys'

/**
 * V2 Workflow Persistence Type Definitions
 *
 * Two-layer state system:
 * - sessionStorage: Per-tab pointers (tiny, scoped by clientId)
 * - localStorage: Persistent drafts (per-scope, per-draft keys)
 */

/**
 * Metadata for a single draft entry stored in the index.
 * The actual workflow data is stored separately in a Draft payload key.
 */
export interface DraftEntryMeta {
  /** Workflow path (e.g., "workflows/Untitled.json") */
  path: string
  /** Display name of the workflow */
  name: string
  /** Whether this is an unsaved temporary workflow */
  isTemporary: boolean
  /**
   * Last metadata update timestamp.
   * Use DraftPayloadV2.updatedAt for content freshness checks.
   */
  updatedAt: number
}

/**
 * Draft index stored in localStorage.
 * Contains LRU order and metadata for all drafts in a storage scope.
 *
 * Key: `Comfy.Workflow.DraftIndex.v2:${scope}`
 */
export interface DraftIndexV2 {
  /** Schema version */
  v: 2
  /** Last index update timestamp, including LRU-only touches. */
  updatedAt: number
  /** LRU order: oldest → newest (draftKey array) */
  order: string[]
  /** Metadata keyed by draftKey (hash of path) */
  entries: Record<string, DraftEntryMeta>
}

/**
 * Individual draft payload stored in localStorage.
 *
 * Key: `Comfy.Workflow.Draft.v2:${scope}:${draftKey}`
 */
export interface DraftPayloadV2 {
  /** Serialized workflow JSON */
  data: string
  /** Last workflow content write timestamp. */
  updatedAt: number
}

/**
 * Pointer stored in sessionStorage to track active workflow per tab.
 * Includes workspaceId for validation on read.
 *
 * Key: `Comfy.Workflow.ActivePath:${clientId}`
 */
export interface ActivePathPointer {
  /**
   * Storage scope this pointer belongs to, for validation on read.
   *
   * Named `workspaceId` for history: it used to hold a bare workspace id and
   * the persisted JSON keeps that field name so pointers written by older
   * builds still validate. It holds a {@link StorageScope} now.
   */
  workspaceId: StorageScope
  /** Path to the active workflow */
  path: string
}

/**
 * Pointer stored in sessionStorage to track open workflow tabs.
 * Includes workspaceId for validation on read.
 *
 * Key: `Comfy.Workflow.OpenPaths:${clientId}`
 */
export interface OpenPathsPointer {
  /** Storage scope this pointer belongs to. See {@link ActivePathPointer}. */
  workspaceId: StorageScope
  /** Ordered list of open workflow paths */
  paths: string[]
  /** Index of the active workflow in paths array */
  activeIndex: number
}

/** Maximum number of drafts to keep per storage scope */
export const MAX_DRAFTS = 32

export const PERSIST_DEBOUNCE_MS = 512

/** What startup did with the workflow, for callers deciding what to show next. */
export type StartupOutcome =
  /** A previously open workflow was loaded. */
  | 'restored'
  /** Nothing to restore; a blank workflow was loaded. */
  | 'fresh'
  /** Blank, but a `?share=`/`?template=` load is still inbound. */
  | 'url-intent'

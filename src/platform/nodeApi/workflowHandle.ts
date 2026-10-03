import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'
import { applyTextReplacements } from '@/utils/searchAndReplace'

import { createDocumentHandle } from './documentHandle'
import type { DocumentHandle, DocumentReader } from './documentHandle'
import { ComfyApiError } from './errors'

/** Parsed ComfyUI workflow JSON. */
export type WorkflowData = Readonly<Record<string, unknown>>

export interface WorkflowOpenOptions {
  /** Replace the active document, or open a separate workflow tab. */
  readonly mode?: 'replace' | 'new'
  /** Display name for a new workflow. It is not a filesystem path. */
  readonly name?: string
}

export interface WorkflowHandle {
  /** Opens parsed ComfyUI workflow JSON, replacing the active document by default. */
  open(data: WorkflowData, options?: WorkflowOpenOptions): Promise<void>
  /** Expands the active document's `%date:...%` and `%Node.widget%` tokens. */
  applyTextReplacements(value: string): string
  /**
   * The active document's identity: a process-local id minted fresh each time
   * a workflow finishes loading — including a second load of the same file,
   * which gets a different id from the first. `undefined` before the first
   * workflow has loaded this page load.
   *
   * Distinct from the workflow's own saved identity (its file path, or the
   * `id` written into the workflow JSON): that one is meant to survive a
   * reload and compare equal across sessions. This one is the opposite by
   * design — it exists so a pack can tell "the document I was looking at got
   * replaced" from "the document I was looking at got edited", which
   * comparing graph contents cannot do, since editing IS mutating the graph
   * contents of the very document that is still current.
   *
   * Equivalent to `current()?.id`, and kept because reading the id is the
   * common case and does not need a handle.
   */
  documentId(): string | undefined
  /**
   * The document on screen, or `undefined` before one is open.
   *
   * A handle rather than the bare id when a pack needs to know what it is
   * looking at — the name to label its own UI, whether there are unsaved
   * edits, and whether a document it stored state for is still open.
   *
   * Read-only: opening has its own explicit call, and saving, closing and
   * renaming belong to the user.
   */
  current(): DocumentHandle | undefined
}

export function createWorkflowApi(
  getGraph: () => LGraph | null | undefined,
  openWorkflow?: (
    data: WorkflowData,
    options: WorkflowOpenOptions
  ) => Promise<void>,
  getDocumentId?: () => string | undefined,
  getDocuments?: DocumentReader
): WorkflowHandle {
  return Object.freeze({
    async open(data: WorkflowData, options?: WorkflowOpenOptions) {
      if (
        extensionValue(data) == null ||
        typeof data !== 'object' ||
        Array.isArray(data)
      ) {
        throw new ComfyApiError('Workflow data must be an object.')
      }
      if (!openWorkflow) {
        throw new ComfyApiError(
          'Workflow loading is not connected to the host.'
        )
      }
      const normalizedOptions = normalizeOpenOptions(options)
      await openWorkflow(data, normalizedOptions)
    },
    applyTextReplacements(value: string) {
      const graph = getGraph()?.rootGraph
      if (!graph) {
        throw new ComfyApiError(
          'Cannot apply workflow text replacements: no graph is active.'
        )
      }
      return applyTextReplacements(graph, value)
    },
    documentId() {
      return getDocumentId?.()
    },
    current() {
      const read = getDocuments ?? (() => [])
      const session = read().find(({ isActive }) => isActive)?.sessionId
      // A document mid-load has a file but not yet a session, and naming it
      // would hand out a handle that never becomes live.
      if (!session) return undefined
      return createDocumentHandle(session, read)
    }
  })
}

function normalizeOpenOptions(
  options: WorkflowOpenOptions | undefined
): WorkflowOpenOptions {
  if (options === undefined) return { mode: 'replace' }
  const value: unknown = extensionValue(options)
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ComfyApiError('Workflow open options must be an object.')
  }
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => key !== 'mode' && key !== 'name')) {
    throw new ComfyApiError('Workflow open options contain an unknown field.')
  }
  const mode = record.mode ?? 'replace'
  if (mode !== 'replace' && mode !== 'new') {
    throw new ComfyApiError("Workflow open mode must be 'replace' or 'new'.")
  }
  if (record.name === undefined) return { mode }
  if (mode !== 'new') {
    throw new ComfyApiError('A workflow name requires mode new.')
  }
  if (!isBoundedWorkflowName(record.name)) {
    throw new ComfyApiError(
      'Workflow name must be a bounded display name without path separators.'
    )
  }
  return { mode, name: record.name }
}

function isBoundedWorkflowName(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length === 0 ||
    Array.from(value).length > 128 ||
    new TextEncoder().encode(value).byteLength > 512 ||
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\')
  ) {
    return false
  }
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code < 32 || code === 127) return false
  }
  return true
}

import { reportError } from '@comfyorg/telemetry/reportError'
import { watch } from 'vue'

import type { HandleCommon } from './closedProxy'
import { addListener } from './listeners'
import type { Unsubscribe } from './widgetHandle'

/** One open workflow: an editing session, not the file behind it. */
export interface DocumentHandle extends HandleCommon {
  /**
   * Identity of this editing session. The same for as long as the document
   * is open, through undo, redo and tab switches, and never reused. It means
   * nothing after a page reload, so do not save it.
   */
  readonly id: string
  /** Display name, without directory or extension. */
  readonly name: string | undefined
  /** Storage path. Changes on rename; undefined once the session has ended. */
  readonly path: string | undefined
  /** Whether there are edits the user has not saved. */
  readonly isModified: boolean
}

/** What the host reports for one open document. */
export interface DocumentSource {
  readonly sessionId: string
  readonly name?: string
  readonly path?: string
  readonly isModified?: boolean
  readonly isActive?: boolean
}

/** Every document currently open, background tabs included. */
export type DocumentReader = () => readonly DocumentSource[]

const DOCUMENT_PHASES = [
  'opened',
  'activated',
  'deactivated',
  'closed'
] as const
type DocumentPhase = (typeof DOCUMENT_PHASES)[number]
type DocumentListener = (document: DocumentHandle) => void

export function createDocuments(read: DocumentReader = () => []) {
  const handles = new Map<string, DocumentHandle>()
  const sourceOf = (id: string) =>
    read().find(({ sessionId }) => sessionId === id)

  function handleFor(id: string): DocumentHandle {
    const existing = handles.get(id)
    if (existing) return existing
    for (const known of handles.keys()) {
      if (!sourceOf(known)) handles.delete(known)
    }
    const handle: DocumentHandle = Object.freeze({
      id,
      get name() {
        return sourceOf(id)?.name
      },
      get path() {
        return sourceOf(id)?.path
      },
      get isModified() {
        return sourceOf(id)?.isModified ?? false
      },
      get isDeleted() {
        return !sourceOf(id)
      }
    })
    handles.set(id, handle)
    return handle
  }

  const listeners = new Map<DocumentPhase, Set<DocumentListener>>(
    DOCUMENT_PHASES.map((phase) => [phase, new Set()])
  )
  const snapshot = () =>
    new Map(read().map((source) => [source.sessionId, !!source.isActive]))
  let open = new Map<string, boolean>()
  let stopWatching: (() => void) | undefined

  function emit(phase: DocumentPhase, id: string): void {
    const document = handleFor(id)
    for (const listener of Array.from(listeners.get(phase)!)) {
      try {
        listener(document)
      } catch (error) {
        reportError(error, {
          errorType: 'node_api_document_listener_failure',
          surface: 'platform',
          tags: { phase }
        })
      }
    }
  }

  function sync(): void {
    const previous = open
    open = snapshot()
    for (const [id, wasActive] of previous) {
      if (wasActive && !open.get(id)) emit('deactivated', id)
    }
    for (const id of previous.keys()) {
      if (!open.has(id)) emit('closed', id)
    }
    for (const id of open.keys()) {
      if (!previous.has(id)) emit('opened', id)
    }
    for (const [id, active] of open) {
      if (active && !previous.get(id)) emit('activated', id)
    }
  }

  const on =
    (phase: DocumentPhase) =>
    (listener: DocumentListener): Unsubscribe => {
      const remove = addListener(listeners.get(phase)!, listener)
      if (!stopWatching) {
        open = snapshot()
        stopWatching = watch(
          () => [...snapshot()].map(([id, active]) => `${id}:${active}`).join(),
          sync
        )
      }
      return () => {
        if (!remove()) return
        if ([...listeners.values()].some((set) => set.size)) return
        stopWatching?.()
        stopWatching = undefined
      }
    }

  return {
    current(): DocumentHandle | undefined {
      const active = read().find(({ isActive }) => isActive)
      return active ? handleFor(active.sessionId) : undefined
    },
    onOpened: on('opened'),
    onActivated: on('activated'),
    onDeactivated: on('deactivated'),
    onClosed: on('closed')
  }
}

export type Documents = ReturnType<typeof createDocuments>

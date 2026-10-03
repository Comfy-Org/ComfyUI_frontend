/**
 * The document a pack is looking at: one editing session of one workflow.
 *
 * A document is not a file and not a graph. The file is the path and bytes on
 * disk, which outlive every session and are shared by every copy. The graph is
 * the content, which the user mutates continuously — so watching it can never
 * answer "am I still looking at the same document", because mutation is what
 * editing one IS.
 *
 * Deliberately read-only. Opening is a user action with its own explicit call,
 * and saving, closing and renaming are the host's; a pack that could close the
 * user's document from a callback is a bug waiting for a name.
 */
import type { HandleCommon } from './closedProxy'

export interface DocumentHandle extends HandleCommon {
  /**
   * Identity of this editing session. Stable for as long as the document is
   * open — including across undo, redo and tab switches — and never reused.
   *
   * Not the id inside the workflow JSON, which travels with the file, so two
   * opens of it and any copy made outside the app all share one value. Not the
   * path either, which is a storage address and changes on rename. Do not
   * persist this: it means nothing in the next page load.
   */
  readonly id: string
  /** Display name, without the directory or extension. */
  readonly name: string | undefined
  /**
   * Storage path, for addressing the file. Undefined for a document with no
   * file behind it yet. Changes when the user renames, so key pack state on
   * {@link id} instead.
   */
  readonly path: string | undefined
  /** Whether there are edits the user has not saved. */
  readonly isModified: boolean
  /**
   * True once this editing session has ended.
   *
   * A handle is a snapshot of a session, and a pack may hold one across a tab
   * close or a background unload. Check before acting on stored state rather
   * than trusting a captured handle, exactly as for a node or a widget.
   */
  readonly isDeleted: boolean
}

/** What the host must supply to describe one open document. */
export interface DocumentSource {
  readonly sessionId: string | null
  readonly filename?: string
  readonly path?: string
  readonly isModified?: boolean
  /** Whether this is the document the editor is showing. */
  readonly isActive?: boolean
}

/**
 * Every document currently open, including background tabs.
 *
 * One reader rather than one per question: a handle has to answer for a
 * document that is open but not on screen, and a lookup that only knew the
 * active one would report every background tab as closed.
 */
export type DocumentReader = () => readonly DocumentSource[]

/**
 * A frozen view of one session.
 *
 * The session id is captured, and liveness is answered by re-reading the open
 * set: a handle whose session has ended reports `isDeleted` rather than
 * quietly describing whichever document took its place.
 */
export function createDocumentHandle(
  session: string,
  read: DocumentReader
): DocumentHandle {
  const live = () => read().find(({ sessionId }) => sessionId === session)
  return Object.freeze({
    id: session,
    get name() {
      return live()?.filename
    },
    get path() {
      return live()?.path
    },
    get isModified() {
      return live()?.isModified ?? false
    },
    get isDeleted() {
      return live() === undefined
    }
  })
}

import { Mutex } from 'es-toolkit'
import { z } from 'zod'

import { getWorkspaceId } from '@/platform/workflow/persistence/base/storageKeys'
import {
  emptyDocument,
  parseSuperGraphDocument
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import type { SuperGraphDocument } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { api } from '@/scripts/api'

export type SaveLocation = 'userdata' | 'browser'

export interface LoadedSuperGraph {
  doc: SuperGraphDocument
  location: SaveLocation
  recovered: boolean
  readFailed: boolean
}

export interface SuperGraphSaver {
  save: (doc: SuperGraphDocument) => Promise<SaveLocation>
  keepInBrowser: (doc: SuperGraphDocument) => void
}

interface Draft {
  doc: SuperGraphDocument
  readFailed: boolean
}

type RemoteRead =
  | { status: 'found'; doc: SuperGraphDocument }
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'unavailable' }

const DOCUMENT_PATH = 'supercomfy/default.json'
const INVALID_PATH = 'supercomfy/default.invalid.json'

const zDraft = z.object({ readFailed: z.boolean(), doc: z.unknown() })

function draftKey(): string {
  return `Comfy.SuperComfy.draft:${getWorkspaceId()}`
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey())
    if (raw === null) return null
    const draft = zDraft.safeParse(JSON.parse(raw))
    if (!draft.success) return null
    const parsed = parseSuperGraphDocument(draft.data.doc)
    return parsed.ok
      ? { doc: parsed.doc, readFailed: draft.data.readFailed }
      : null
  } catch {
    return null
  }
}

function writeDraft(draft: Draft): void {
  try {
    localStorage.setItem(draftKey(), JSON.stringify(draft))
  } catch {
    return
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(draftKey())
  } catch {
    return
  }
}

async function readRemote(): Promise<RemoteRead> {
  try {
    const response = await api.getUserData(DOCUMENT_PATH)
    if (response.status === 404) return { status: 'missing' }
    if (response.status !== 200) return { status: 'unavailable' }
    const parsed = parseSuperGraphDocument(await response.json())
    return parsed.ok
      ? { status: 'found', doc: parsed.doc }
      : { status: 'invalid' }
  } catch {
    return { status: 'unavailable' }
  }
}

async function moveInvalidAside(): Promise<boolean> {
  try {
    const response = await api.moveUserData(DOCUMENT_PATH, INVALID_PATH, {
      overwrite: true
    })
    return response.status === 200
  } catch {
    return false
  }
}

function newest(
  candidates: readonly (SuperGraphDocument | undefined)[]
): SuperGraphDocument {
  return candidates.reduce<SuperGraphDocument>(
    (best, candidate) =>
      candidate && candidate.savedAt > best.savedAt ? candidate : best,
    emptyDocument()
  )
}

/** Loads the document from userdata or the browser copy, newest first. */
export async function loadSuperGraph(): Promise<LoadedSuperGraph> {
  const draft = readDraft()
  const remote = await readRemote()
  if (remote.status === 'found') {
    return {
      doc: newest([remote.doc, draft?.readFailed ? undefined : draft?.doc]),
      location: 'userdata',
      recovered: false,
      readFailed: false
    }
  }
  if (remote.status === 'invalid') {
    const moved = await moveInvalidAside()
    return {
      doc: newest([draft?.doc]),
      location: moved ? 'userdata' : 'browser',
      recovered: true,
      readFailed: false
    }
  }
  return {
    doc: newest([draft?.doc]),
    location: remote.status === 'missing' ? 'userdata' : 'browser',
    recovered: false,
    readFailed: remote.status === 'unavailable'
  }
}

async function storeRemote(body: string): Promise<boolean> {
  try {
    const response = await api.storeUserData(DOCUMENT_PATH, body, {
      overwrite: true,
      stringify: false,
      throwOnError: false
    })
    return response.status === 200
  } catch {
    return false
  }
}

function stamped(doc: SuperGraphDocument): SuperGraphDocument {
  return { ...doc, savedAt: Date.now() }
}

/** Returns a serialised saver that falls back to the browser for the session. */
export function createSuperGraphSaver({
  location: initial,
  readFailed
}: Pick<LoadedSuperGraph, 'location' | 'readFailed'>): SuperGraphSaver {
  const mutex = new Mutex()
  let location = initial

  async function save(doc: SuperGraphDocument): Promise<SaveLocation> {
    await mutex.acquire()
    try {
      const next = stamped(doc)
      if (
        location === 'userdata' &&
        (await storeRemote(JSON.stringify(next)))
      ) {
        clearDraft()
        return location
      }
      location = 'browser'
      writeDraft({ doc: next, readFailed })
      return location
    } finally {
      mutex.release()
    }
  }

  return {
    save,
    keepInBrowser: (doc) => writeDraft({ doc: stamped(doc), readFailed })
  }
}

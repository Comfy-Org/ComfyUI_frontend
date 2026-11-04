import { Mutex } from 'es-toolkit'

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
}

type RemoteRead =
  | { status: 'found'; doc: SuperGraphDocument }
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'unavailable' }

const DOCUMENT_PATH = 'supercomfy/default.json'
const INVALID_PATH = 'supercomfy/default.invalid.json'

function draftKey(): string {
  return `Comfy.SuperComfy.draft:${getWorkspaceId()}`
}

function readDraft(): SuperGraphDocument | null {
  try {
    const raw = localStorage.getItem(draftKey())
    if (raw === null) return null
    const parsed = parseSuperGraphDocument(JSON.parse(raw))
    return parsed.ok ? parsed.doc : null
  } catch {
    return null
  }
}

function writeDraft(body: string): boolean {
  try {
    localStorage.setItem(draftKey(), body)
    return true
  } catch {
    return false
  }
}

function clearDraft(): boolean {
  try {
    localStorage.removeItem(draftKey())
    return true
  } catch {
    return false
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
  candidates: readonly (SuperGraphDocument | null)[]
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
      doc: newest([remote.doc, draft]),
      location: 'userdata',
      recovered: false
    }
  }
  if (remote.status === 'invalid') {
    const moved = await moveInvalidAside()
    return {
      doc: newest([draft]),
      location: moved ? 'userdata' : 'browser',
      recovered: true
    }
  }
  return {
    doc: newest([draft]),
    location: remote.status === 'missing' ? 'userdata' : 'browser',
    recovered: false
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

/** Keeps the document in the browser right away, for a page that is closing. */
export function saveDraftNow(doc: SuperGraphDocument): void {
  writeDraft(JSON.stringify({ ...doc, savedAt: Date.now() }))
}

/** Returns a serialised saver that falls back to the browser for the session. */
export function createSuperGraphSaver(
  initial: SaveLocation = 'userdata'
): (doc: SuperGraphDocument) => Promise<SaveLocation> {
  const mutex = new Mutex()
  let location = initial

  return async (doc) => {
    await mutex.acquire()
    try {
      const body = JSON.stringify({ ...doc, savedAt: Date.now() })
      if (location === 'userdata' && (await storeRemote(body))) {
        clearDraft()
        return location
      }
      location = 'browser'
      writeDraft(body)
      return location
    } finally {
      mutex.release()
    }
  }
}

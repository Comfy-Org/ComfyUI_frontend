import { z } from 'zod'
import { validateCreativeSettings } from './creative'

import { cameraGroups, gradeGroup, lookGroups } from './catalog'

const DATABASE = 'comfy-cinema-creations'
const STORE = 'creations'
export const CREATION_LIMITS = { count: 100, bytes: 512 * 1024 * 1024 }

const directionChoice = (part: string) =>
  z
    .string()
    .refine((id) =>
      [...cameraGroups, ...lookGroups, gradeGroup]
        .find((group) => group.part === part)
        ?.options.some((option) => option.id === id)
    )

const settingsSchema = z.object({
  creative: z
    .unknown()
    .transform((value, context) => {
      try {
        return validateCreativeSettings(value)
      } catch {
        context.addIssue({
          code: 'custom',
          message: 'Invalid creative settings'
        })
        return z.NEVER
      }
    })
    .optional(),
  scene: z.string().max(50000),
  mode: z.enum(['image', 'video']),
  enhance: z.boolean(),
  resolution: z.enum(['1K', '2K']).optional(),
  duration: z.number().positive().max(120).optional(),
  aspect: z.enum(['21:9', '16:9', '4:3', '1:1', '9:16']).optional(),
  resolutionPixels: z.number().int().positive().max(16384).optional(),
  takes: z.number().int().min(1).max(4).optional(),
  seed: z.number().int().nonnegative().optional(),
  sourceId: z.string().max(200).optional(),
  operation: z
    .enum(['generate', 'edit', 'camera', 'look', 'relight'])
    .optional(),
  video: z
    .object({
      durationSeconds: z.number().positive().max(120),
      resolution: z
        .string()
        .min(1)
        .max(32)
        .regex(/^[a-zA-Z0-9:_-]+$/),
      generateAudio: z.boolean()
    })
    .optional(),
  direction: z.object({
    body: directionChoice('body'),
    lens: directionChoice('lens'),
    focal: directionChoice('focal'),
    aperture: directionChoice('aperture'),
    shot: directionChoice('shot'),
    light: directionChoice('light'),
    film: directionChoice('film'),
    look: directionChoice('look'),
    grade: directionChoice('grade')
  })
})

const creationSchema = z.object({
  id: z.string().min(1).max(200),
  takeId: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  modelSlug: z.string().min(1).max(200),
  prompt: z.string().max(50000),
  aspect: z.enum(['21:9', '16:9', '4:3', '1:1', '9:16']),
  createdAt: z.number().finite().nonnegative(),
  kind: z.enum(['image', 'video']),
  fileName: z.string().min(1).max(500),
  nsfw: z.boolean(),
  favorite: z.boolean().default(false),
  blob: z.custom<Blob>((value) => value instanceof Blob),
  settings: settingsSchema.optional()
})

export type SavedCreation = z.infer<typeof creationSchema>
export type CreationSettings = z.infer<typeof settingsSchema>
export type CreationInput = z.input<typeof creationSchema>

export function creationNamespace(
  scope: { mode: 'demo' } | { mode: 'live'; uid: string; workspaceId: string }
): string {
  if (scope.mode === 'demo') return 'demo'
  if (!scope.uid || !scope.workspaceId) throw new Error('Missing account scope')
  return JSON.stringify([scope.uid, scope.workspaceId])
}

function access<T>(
  namespace: string,
  mode: IDBTransactionMode,
  operate: (
    store: IDBObjectStore,
    finish: (value: T) => void,
    fail: (error: unknown) => void
  ) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!namespace) {
      reject(new Error('Missing creation namespace'))
      return
    }
    let database: IDBDatabase | undefined
    let transaction: IDBTransaction | undefined
    let done = false
    let result: T
    const finish = (error?: unknown) => {
      if (done) return
      done = true
      clearTimeout(timeout)
      database?.close()
      if (error) reject(error)
      else resolve(result)
    }
    const timeout = setTimeout(() => {
      transaction?.abort()
      finish(new DOMException('Creation storage timed out', 'TimeoutError'))
    }, 10000)
    try {
      const opening = indexedDB.open(DATABASE, 1)
      opening.onupgradeneeded = () => {
        opening.result
          .createObjectStore(STORE)
          .createIndex('namespace', 'namespace')
      }
      opening.onerror = () => finish(opening.error)
      opening.onblocked = () => finish(new Error('Creation storage blocked'))
      opening.onsuccess = () => {
        database = opening.result
        if (done) {
          database.close()
          return
        }
        database.onversionchange = () => database?.close()
        try {
          transaction = database.transaction(STORE, mode)
          transaction.oncomplete = () => finish()
          transaction.onabort = () =>
            finish(transaction?.error ?? new Error('Creation storage aborted'))
          transaction.onerror = () =>
            finish(transaction?.error ?? new Error('Creation storage failed'))
          operate(
            transaction.objectStore(STORE),
            (value) => {
              result = value
            },
            (error) => {
              transaction?.abort()
              finish(error)
            }
          )
        } catch (error) {
          transaction?.abort()
          finish(error)
        }
      }
    } catch (error) {
      finish(error)
    }
  })
}

function readRecords(value: unknown): SavedCreation[] {
  return z.array(creationSchema).parse(value)
}

export function listCreations(namespace: string): Promise<SavedCreation[]> {
  return access(namespace, 'readonly', (store, finish, fail) => {
    const request = store.index('namespace').getAll(namespace)
    request.onsuccess = () => {
      try {
        finish(
          readRecords(request.result).sort((a, b) => b.createdAt - a.createdAt)
        )
      } catch (error) {
        fail(error)
      }
    }
  })
}

export async function saveCreation(
  namespace: string,
  input: CreationInput
): Promise<SavedCreation> {
  const creation = creationSchema.parse(input)
  if (!creation.blob.size) throw new Error('Creation media is empty')
  return access(namespace, 'readwrite', (store, finish, fail) => {
    const request = store.index('namespace').getAll(namespace)
    request.onsuccess = () => {
      try {
        const records = readRecords(request.result).filter(
          (record) => record.id !== creation.id
        )
        const bytes = records.reduce(
          (sum, record) => sum + record.blob.size,
          creation.blob.size
        )
        if (
          records.length >= CREATION_LIMITS.count ||
          bytes > CREATION_LIMITS.bytes
        ) {
          fail(
            new DOMException(
              'Saved creations limit reached',
              'QuotaExceededError'
            )
          )
          return
        }
        store.put({ ...creation, namespace }, [namespace, creation.id])
        finish(creation)
      } catch (error) {
        fail(error)
      }
    }
  })
}

export function deleteCreation(namespace: string, id: string): Promise<void> {
  return access(namespace, 'readwrite', (store, finish) => {
    store.delete([namespace, id])
    finish()
  })
}

function updateCreation(
  namespace: string,
  id: string,
  changes: Partial<Pick<SavedCreation, 'name' | 'favorite'>>
): Promise<SavedCreation> {
  return access(namespace, 'readwrite', (store, finish, fail) => {
    const request = store.get([namespace, id])
    request.onsuccess = () => {
      try {
        const creation = creationSchema.parse({
          ...creationSchema.parse(request.result),
          ...changes
        })
        store.put({ ...creation, namespace }, [namespace, id])
        finish(creation)
      } catch (error) {
        fail(error)
      }
    }
  })
}

export function renameCreation(
  namespace: string,
  id: string,
  name: string
): Promise<SavedCreation> {
  return updateCreation(namespace, id, { name })
}

export function favoriteCreation(
  namespace: string,
  id: string,
  favorite: boolean
): Promise<SavedCreation> {
  return updateCreation(namespace, id, { favorite })
}

import { z } from 'zod'
import { MODALITIES } from '../../../config/models-catalogue'

const DATABASE = 'comfy-cinema-model-results'
const STORE = 'results'
export const MODEL_RESULT_LIMITS = {
  count: 100,
  bytes: 512 * 1024 * 1024,
  outputs: 100
} as const
const identity = z.string().min(1).max(200)
const namespaceSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => !!value.trim())
const outputSchema = z
  .object({
    kind: z.enum([...MODALITIES, 'other']),
    fileName: z.string().min(1).max(500),
    nsfw: z.boolean().default(false),
    blob: z.custom<Blob>(
      (value) =>
        value instanceof Blob &&
        Number.isSafeInteger(value.size) &&
        value.size > 0
    )
  })
  .strict()
const resultSchema = z
  .object({
    id: identity,
    name: z.string().trim().min(1).max(200),
    modelSlug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9._-]+$/),
    createdAt: z.number().finite().nonnegative(),
    outputs: z.array(outputSchema).min(1).max(MODEL_RESULT_LIMITS.outputs)
  })
  .strict()
const storedSchema = resultSchema.extend({ namespace: namespaceSchema })
export type ModelResult = z.infer<typeof resultSchema>
export type ModelResultInput = z.input<typeof resultSchema>
export type ModelResultOutput = z.infer<typeof outputSchema>

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
    let database: IDBDatabase | undefined
    let transaction: IDBTransaction | undefined
    let settled = false
    let result: T
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      database?.close()
      if (error) reject(error)
      else resolve(result)
    }
    const fail = (error: unknown) => {
      try {
        transaction?.abort()
      } catch {
        /* A completed transaction cannot be aborted. */
      }
      finish(error)
    }
    const timeout = setTimeout(
      () =>
        fail(
          new DOMException('Model result storage timed out', 'TimeoutError')
        ),
      10000
    )
    try {
      namespaceSchema.parse(namespace)
      const opening = indexedDB.open(DATABASE, 1)
      opening.onupgradeneeded = () =>
        opening.result
          .createObjectStore(STORE)
          .createIndex('namespace', 'namespace')
      opening.onerror = () =>
        finish(opening.error ?? new Error('Model result storage failed'))
      opening.onblocked = () =>
        finish(new Error('Model result storage blocked'))
      opening.onsuccess = () => {
        database = opening.result
        if (settled) {
          database.close()
          return
        }
        database.onversionchange = () => database?.close()
        try {
          transaction = database.transaction(STORE, mode)
          transaction.oncomplete = () => finish()
          transaction.onabort = () =>
            finish(
              transaction?.error ?? new Error('Model result storage aborted')
            )
          transaction.onerror = () =>
            finish(
              transaction?.error ?? new Error('Model result storage failed')
            )
          operate(
            transaction.objectStore(STORE),
            (value) => {
              result = value
            },
            fail
          )
        } catch (error) {
          fail(error)
        }
      }
    } catch (error) {
      finish(error)
    }
  })
}

function records(value: unknown): ModelResult[] {
  return z
    .array(storedSchema)
    .parse(value)
    .map(({ namespace: _namespace, ...record }) => record)
}

export function listModelResults(namespace: string): Promise<ModelResult[]> {
  return access(namespace, 'readonly', (store, finish, fail) => {
    const request = store.index('namespace').getAll(namespace)
    request.onsuccess = () => {
      try {
        finish(
          records(request.result).sort((a, b) => b.createdAt - a.createdAt)
        )
      } catch (error) {
        fail(error)
      }
    }
  })
}

export async function saveModelResult(
  namespace: string,
  input: ModelResultInput
): Promise<ModelResult> {
  const result = resultSchema.parse(input)
  return access(namespace, 'readwrite', (store, finish, fail) => {
    const request = store.index('namespace').getAll(namespace)
    request.onsuccess = () => {
      try {
        const others = records(request.result).filter(
          (record) => record.id !== result.id
        )
        const bytes = [...others, result].reduce(
          (total, record) =>
            total +
            record.outputs.reduce((sum, output) => sum + output.blob.size, 0),
          0
        )
        if (
          others.length >= MODEL_RESULT_LIMITS.count ||
          bytes > MODEL_RESULT_LIMITS.bytes
        ) {
          fail(
            new DOMException(
              'Saved model results limit reached',
              'QuotaExceededError'
            )
          )
          return
        }
        store.put({ ...result, namespace }, [namespace, result.id])
        finish(result)
      } catch (error) {
        fail(error)
      }
    }
  })
}

export async function deleteModelResult(
  namespace: string,
  id: string
): Promise<void> {
  identity.parse(id)
  return access(namespace, 'readwrite', (store, finish) => {
    store.delete([namespace, id])
    finish()
  })
}

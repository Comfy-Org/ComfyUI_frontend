import { z } from 'zod'

const referenceSchema = z.object({
  role: z.enum(['cast', 'palette', 'first', 'last', 'asset', 'edit']),
  assetId: z.string().max(100).optional(),
  name: z.string().min(1).max(500),
  blob: z.custom<Blob>(
    (value) =>
      value instanceof Blob &&
      value.size > 0 &&
      value.size <= 12 * 1024 * 1024 &&
      ['image/png', 'image/jpeg', 'image/webp'].includes(value.type)
  )
})
const bundleSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  references: z.array(referenceSchema).min(1).max(20)
})
export type StoredReference = z.infer<typeof referenceSchema>
export interface ReferenceFile {
  role: StoredReference['role']
  assetId?: string
  file: File
}

function access<T>(
  namespace: string,
  mode: IDBTransactionMode,
  action: (
    store: IDBObjectStore,
    done: (value: T) => void,
    fail: (error: unknown) => void
  ) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!namespace.trim() || namespace.length > 500) {
      reject(new Error('Missing reference namespace'))
      return
    }
    let database: IDBDatabase | undefined
    let transaction: IDBTransaction | undefined
    let result: T
    let settled = false
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      database?.close()
      if (error) reject(error)
      else resolve(result)
    }
    const fail = (error: unknown) => {
      transaction?.abort()
      finish(error)
    }
    const timeout = setTimeout(
      () =>
        fail(new DOMException('Reference storage timed out', 'TimeoutError')),
      10000
    )
    try {
      const opening = indexedDB.open('comfy-cinema-reference-bundles', 1)
      opening.onupgradeneeded = () =>
        opening.result
          .createObjectStore('bundles')
          .createIndex('namespace', 'namespace')
      opening.onerror = () => finish(opening.error)
      opening.onblocked = () => finish(new Error('Reference storage blocked'))
      opening.onsuccess = () => {
        database = opening.result
        if (settled) {
          database.close()
          return
        }
        database.onversionchange = () => database?.close()
        try {
          transaction = database.transaction('bundles', mode)
          transaction.oncomplete = () => finish()
          transaction.onabort = () =>
            finish(transaction?.error ?? new Error('Reference storage aborted'))
          transaction.onerror = () =>
            finish(transaction?.error ?? new Error('Reference storage failed'))
          action(
            transaction.objectStore('bundles'),
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

export async function saveReferenceBundle(
  namespace: string,
  files: readonly ReferenceFile[]
): Promise<string | undefined> {
  if (!files.length) return
  const references = z
    .array(referenceSchema)
    .min(1)
    .max(20)
    .parse(
      files.map(({ role, assetId, file }) => ({
        role,
        assetId,
        name: file.name,
        blob: file
      }))
    )
  const bytes = new TextEncoder().encode(
    JSON.stringify(
      await Promise.all(
        references.map(async (reference) => ({
          role: reference.role,
          assetId: reference.assetId,
          name: reference.name,
          type: reference.blob.type,
          hash: Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                'SHA-256',
                await reference.blob.arrayBuffer()
              )
            ),
            (value) => value.toString(16).padStart(2, '0')
          ).join('')
        }))
      )
    )
  )
  const id = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (value) => value.toString(16).padStart(2, '0')
  ).join('')
  await access<void>(namespace, 'readwrite', (store, done, fail) => {
    const request = store.index('namespace').getAll(namespace)
    request.onsuccess = () => {
      try {
        const others = z
          .array(bundleSchema)
          .parse(request.result)
          .filter((bundle) => bundle.id !== id)
        const total = [
          ...others.flatMap((bundle) => bundle.references),
          ...references
        ].reduce((sum, reference) => sum + reference.blob.size, 0)
        if (others.length >= 100 || total > 128 * 1024 * 1024)
          throw new DOMException(
            'Reference storage limit reached',
            'QuotaExceededError'
          )
        store.put({ id, references, namespace }, [namespace, id])
        done()
      } catch (error) {
        fail(error)
      }
    }
  })
  return id
}

export function loadReferenceBundle(
  namespace: string,
  id: string
): Promise<ReferenceFile[]> {
  return access(namespace, 'readonly', (store, done, fail) => {
    const request = store.get([namespace, id])
    request.onsuccess = () => {
      try {
        const bundle = bundleSchema.parse(request.result)
        done(
          bundle.references.map(({ role, assetId, name, blob }) => ({
            role,
            assetId,
            file: new File([blob], name, { type: blob.type })
          }))
        )
      } catch (error) {
        fail(error)
      }
    }
  })
}

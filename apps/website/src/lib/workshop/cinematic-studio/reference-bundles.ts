import { accessStudioStorage } from './storage'
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

const storage = {
  database: 'comfy-cinema-reference-bundles',
  store: 'bundles',
  label: 'Reference',
  namespaceLabel: 'reference'
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
  await accessStudioStorage<void>(
    storage,
    namespace,
    'readwrite',
    (store, done, fail) => {
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
    }
  )
  return id
}

export function loadReferenceBundle(
  namespace: string,
  id: string
): Promise<ReferenceFile[]> {
  return accessStudioStorage(
    storage,
    namespace,
    'readonly',
    (store, done, fail) => {
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
    }
  )
}

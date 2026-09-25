import { accessStudioStorage } from './storage'
import { z } from 'zod'
import { MODALITIES } from '../../../config/models-catalogue'

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

const storage = {
  database: 'comfy-cinema-model-results',
  store: 'results',
  label: 'Model result',
  namespaceLabel: 'model result'
}

function records(value: unknown): ModelResult[] {
  return z
    .array(storedSchema)
    .parse(value)
    .map(({ namespace: _namespace, ...record }) => record)
}

export function listModelResults(namespace: string): Promise<ModelResult[]> {
  return accessStudioStorage(
    storage,
    namespace,
    'readonly',
    (store, finish, fail) => {
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
    }
  )
}

export async function saveModelResult(
  namespace: string,
  input: ModelResultInput
): Promise<ModelResult> {
  const result = resultSchema.parse(input)
  return accessStudioStorage(
    storage,
    namespace,
    'readwrite',
    (store, finish, fail) => {
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
    }
  )
}

export async function deleteModelResult(
  namespace: string,
  id: string
): Promise<void> {
  identity.parse(id)
  return accessStudioStorage(
    storage,
    namespace,
    'readwrite',
    (store, finish) => {
      store.delete([namespace, id])
      finish()
    }
  )
}

import type { FieldSchema, FileValue, FormValues } from './workshop-playground'
import { urlUploadField, validateForm } from './workshop-playground'
import { WorkshopRouterError } from './workshop-router-errors'
import { isHttpImageSource } from './workshop-image-source'
import {
  loadWorkshopExampleFile,
  workshopExampleFile
} from './workshop-example-file'

const downloadedSources = new Map<string, FileValue>()
const formSources = new WeakMap<FormValues, ReadonlyMap<string, FileValue>>()
const REHOST_SOURCE =
  /^https:\/\/cdn\.jsdelivr\.net\/gh\/Comfy-Org\/workflow_templates@[^/]+\//

async function rehostUrlInputs(
  fields: readonly FieldSchema[],
  values: FormValues,
  signal: AbortSignal
): Promise<FormValues> {
  const pending = fields.flatMap((field) => {
    const source = values[field.name]
    return urlUploadField(field) &&
      typeof source === 'string' &&
      isHttpImageSource(source) &&
      REHOST_SOURCE.test(source)
      ? [{ field, source }]
      : []
  })
  if (!pending.length) return values
  const errors = validateForm(fields, values)
  if (Object.keys(errors).length)
    throw new WorkshopRouterError('validation', null, errors)
  const previous = formSources.get(values)
  const retained = new Map<string, FileValue>()
  const resolved = { ...values }
  for (const { field, source } of pending) {
    signal.throwIfAborted()
    try {
      let selected = previous?.get(source) ?? downloadedSources.get(source)
      if (!selected) {
        const example = workshopExampleFile(source)
        if (!example) throw new Error('Invalid source URL')
        const file = await loadWorkshopExampleFile(example, signal)
        signal.throwIfAborted()
        selected = { file, name: file.name, type: file.type, size: file.size }
      }
      // Preserve File identity so retries reuse the scoped storage URL.
      retained.set(source, selected)
      downloadedSources.delete(source)
      downloadedSources.set(source, selected)
      if (downloadedSources.size > 8) {
        const oldest = downloadedSources.keys().next().value
        if (oldest !== undefined) downloadedSources.delete(oldest)
      }
      resolved[field.name] = selected
    } catch {
      signal.throwIfAborted()
      throw new WorkshopRouterError('validation', null, {
        [field.name]: 'uploadFailed'
      })
    }
  }
  formSources.set(values, retained)
  return resolved
}

export type WorkshopUrlEncoder = (
  file: File,
  signal: AbortSignal
) => Promise<string>

export async function resolveWorkshopUrlInputs(
  fields: readonly FieldSchema[],
  values: FormValues,
  signal: AbortSignal,
  upload?: WorkshopUrlEncoder,
  rehostUrls = false
): Promise<FormValues> {
  if (rehostUrls) values = await rehostUrlInputs(fields, values, signal)
  if (
    !fields.some(
      (field) => urlUploadField(field) && typeof values[field.name] === 'object'
    )
  )
    return values
  const errors = validateForm(fields, values)
  if (Object.keys(errors).length)
    throw new WorkshopRouterError('validation', null, errors)
  const pending = fields.flatMap((field) => {
    const value = values[field.name]
    if (!urlUploadField(field) || typeof value !== 'object') return []
    const selected = Array.isArray(value) ? value : [value]
    return selected.map((item) => {
      if (!(item.file instanceof File))
        throw new WorkshopRouterError('validation', null, {
          [field.name]: 'required'
        })
      const file = item.file
      const actualErrors = validateForm([field], {
        [field.name]: { name: file.name, type: file.type, size: file.size }
      })
      if (Object.keys(actualErrors).length)
        throw new WorkshopRouterError('validation', null, actualErrors)
      return { field, file }
    })
  })
  const resolved = { ...values }
  for (const { field, file } of pending) {
    signal.throwIfAborted()
    try {
      if (!upload) throw new Error('Upload unavailable')
      const url = await upload(file, signal)
      signal.throwIfAborted()
      const errors = validateForm([field], { [field.name]: url })
      if (!isHttpImageSource(url) || Object.keys(errors).length)
        throw new Error('Invalid upload URL')
      resolved[field.name] = url
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof WorkshopRouterError) throw error
      throw new WorkshopRouterError('validation', null, {
        [field.name]: 'uploadFailed'
      })
    }
  }
  return resolved
}

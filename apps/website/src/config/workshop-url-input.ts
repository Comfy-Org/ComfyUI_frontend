import type { FieldSchema, FormValues } from './workshop-playground'
import { urlUploadField, validateForm } from './workshop-playground'
import { WorkshopRouterError } from './workshop-router-errors'
import { isHttpImageSource } from './workshop-image-source'

export type WorkshopUrlEncoder = (
  file: File,
  signal: AbortSignal
) => Promise<string>

export async function resolveWorkshopUrlInputs(
  fields: readonly FieldSchema[],
  values: FormValues,
  signal: AbortSignal,
  upload?: WorkshopUrlEncoder
): Promise<FormValues> {
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

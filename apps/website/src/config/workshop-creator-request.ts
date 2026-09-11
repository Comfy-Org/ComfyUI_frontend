import { z } from 'astro/zod'

import type { WorkshopCreatorForm } from './workshop-creator-form'
import type { FormValues } from './workshop-playground'
import { MAX_UPLOAD_BYTES } from './workshop-playground'
import { workshopFileBase64 } from './workshop-file-encoding'
import { WorkshopRouterError } from './workshop-router-errors'
import { renderWorkshopRequestTemplate } from './workshop-request-template'
import { prepareWorkshopRequestCallback } from './workshop-request-callbacks'
import { loadWorkshopExampleFile } from './workshop-example-file'
import { MAX_REQUEST_BYTES } from './workshop-limits'

export interface EncodedWorkshopFile {
  readonly data: string
  readonly mimeType: string
}

export interface WorkshopRequestInputs {
  readonly values: Readonly<Partial<Record<string, string | number | boolean>>>
  readonly files: Readonly<
    Partial<Record<string, readonly EncodedWorkshopFile[]>>
  >
}

const scalar = z.union([z.string(), z.number().finite(), z.boolean()])
const ACCEPT: Record<
  WorkshopCreatorForm['files'][number]['accept'],
  readonly string[]
> = {
  image: ['image/png', 'image/jpeg', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4'],
  file: []
}

export async function prepareWorkshopCreatorRequest(
  definition: WorkshopCreatorForm,
  values: FormValues,
  signal: AbortSignal,
  encodeFile = workshopFileBase64
): Promise<Record<string, unknown>> {
  const fileNames = new Set(definition.files.map((field) => field.name))
  const plain: Record<string, string | number | boolean> = {
    ...definition.fixedValues
  }
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || fileNames.has(name)) continue
    if (value === '' && definition.request.kind === 'callback') continue
    const input = definition.inputs[name]
    const parsed = scalar.safeParse(value)
    if (
      !Object.hasOwn(definition.inputs, name) ||
      input.hidden ||
      !parsed.success
    )
      throw new WorkshopRouterError('validation', null, { [name]: 'rejected' })
    plain[name] = parsed.data
  }
  let bytes = new TextEncoder().encode(JSON.stringify(plain)).byteLength
  function reserve(file: { size: number; type: string }, name: string) {
    bytes += 4 * Math.ceil(file.size / 3) + file.type.length + 256
    if (bytes > MAX_REQUEST_BYTES)
      throw new WorkshopRouterError('validation', null, {
        [name]: 'requestTooLarge'
      })
  }
  const uploads = definition.files.flatMap((field) => {
    const value = values[field.name]
    const files =
      value === undefined ? [] : Array.isArray(value) ? value : [value]
    if ((field.required && !files.length) || files.length > field.maxItems)
      throw new WorkshopRouterError('validation', null, {
        [field.name]: files.length ? 'rejected' : 'required'
      })
    return files.map((value) => {
      if (
        typeof value !== 'object' ||
        (!(value.file instanceof File) && !value.sourceUrl)
      )
        throw new WorkshopRouterError('validation', null, {
          [field.name]: 'required'
        })
      const file = value.file ?? value
      const accept = field.mimeTypes ?? ACCEPT[field.accept]
      if (accept.length && !accept.includes(file.type))
        throw new WorkshopRouterError('validation', null, {
          [field.name]: 'badType'
        })
      if (file.size > MAX_UPLOAD_BYTES)
        throw new WorkshopRouterError('validation', null, {
          [field.name]: 'tooLarge'
        })
      if (value.file instanceof File) reserve(value.file, field.name)
      return { name: field.name, value, accept }
    })
  })
  const files: Record<string, EncodedWorkshopFile[]> = {}
  for (const { name, value, accept } of uploads) {
    let file: File
    try {
      file =
        value.file instanceof File
          ? value.file
          : await loadWorkshopExampleFile(value, signal)
    } catch {
      signal.throwIfAborted()
      throw new WorkshopRouterError('validation', null, {
        [name]: 'uploadFailed'
      })
    }
    if (accept.length && !accept.includes(file.type))
      throw new WorkshopRouterError('validation', null, { [name]: 'badType' })
    if (!(value.file instanceof File)) reserve(file, name)
    const encoded = {
      data: await encodeFile(file, signal),
      mimeType: file.type
    }
    files[name] = [...(files[name] ?? []), encoded]
  }
  signal.throwIfAborted()
  return definition.request.kind === 'template'
    ? renderWorkshopRequestTemplate(definition.request.template, plain)
    : prepareWorkshopRequestCallback(definition.request, {
        values: plain,
        files
      })
}

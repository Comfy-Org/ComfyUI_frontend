import type { FieldSchema, FieldValue, FileValue } from './workshop-playground'
import { urlUploadField } from './workshop-playground'
import { workshopExampleFile } from './workshop-example-file'
import { WorkshopRouterError } from './workshop-router-errors'

export type RouterMedia =
  | string
  | Blob
  | {
      readonly data: Uint8Array | ArrayBuffer
      readonly mimeType: string
      readonly name?: string
    }

const files = new WeakMap<Blob, File>()

function rejected(field: FieldSchema): never {
  throw new WorkshopRouterError('validation', null, {
    [field.name]: 'badType'
  })
}

function mediaFile(value: unknown, field: FieldSchema): FileValue {
  const upload = field.kind === 'file' ? field : urlUploadField(field)
  const fallbackType = upload?.accept[0] ?? 'application/octet-stream'
  if (typeof value === 'string' && /^https?:\/\//i.test(value))
    return workshopExampleFile(value, fallbackType) ?? rejected(field)
  if (typeof value === 'string') {
    const match = /^data:([\w.+-]+\/[\w.+-]+);base64,([\s\S]*)$/i.exec(value)
    if (!match) return rejected(field)
    try {
      const decoded = atob(match[2])
      const data = Uint8Array.from(decoded, (character) =>
        character.charCodeAt(0)
      )
      return mediaFile(new Blob([data], { type: match[1] }), field)
    } catch {
      return rejected(field)
    }
  }
  if (value instanceof Blob) {
    const file =
      value instanceof File
        ? value
        : (files.get(value) ??
          new File([value], field.name, { type: value.type || fallbackType }))
    files.set(value, file)
    return { file, name: file.name, type: file.type, size: file.size }
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if (
      'data' in value &&
      (value.data instanceof Uint8Array || value.data instanceof ArrayBuffer) &&
      'mimeType' in value &&
      typeof value.mimeType === 'string'
    ) {
      const data = new Uint8Array(value.data)
      const name =
        'name' in value && typeof value.name === 'string'
          ? value.name
          : field.name
      return mediaFile(new File([data], name, { type: value.mimeType }), field)
    }
    if ('file' in value && value.file instanceof File)
      return mediaFile(value.file, field)
    if ('sourceUrl' in value && typeof value.sourceUrl === 'string')
      return mediaFile(value.sourceUrl, field)
  }
  return rejected(field)
}

export function routerMediaValue(
  field: FieldSchema,
  value: unknown
): FieldValue {
  const multiple = field.kind === 'file' && field.multiple
  const items = Array.isArray(value) ? value : [value]
  if (items.length > 1 && !multiple) return rejected(field)
  if (field.kind === 'text' && typeof items[0] === 'string') {
    const source = items[0]
    if (/^https?:\/\//i.test(source))
      return workshopExampleFile(source) ? source : rejected(field)
  }
  if (field.kind !== 'file' && !urlUploadField(field)) return rejected(field)
  const files = items.map((item) => mediaFile(item, field))
  return multiple ? files : files[0]
}

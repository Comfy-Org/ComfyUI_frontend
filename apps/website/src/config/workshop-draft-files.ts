import type {
  FieldSchema,
  FieldValue,
  FileValue,
  FormValues
} from './workshop-playground'
import { urlUploadField, validateForm } from './workshop-playground'
import { workshopExampleFile } from './workshop-example-file'
import { routerMediaValue } from './router-media'

const MAX_DRAFT_BYTES = 100 * 1024 * 1024

type DraftFile = File | string
export type DraftFiles = Readonly<
  Record<string, DraftFile | DraftFile[] | null>
>

function packFile(value: FileValue): DraftFile {
  if (value.sourceDataUrl) return value.sourceDataUrl
  if (value.file) return value.file
  if (value.sourceUrl) return value.sourceUrl
  throw new Error('File has no restorable source')
}

function packValue(value: FieldValue) {
  if (value === undefined || value === '') return null
  if (Array.isArray(value)) return value.map(packFile)
  if (typeof value === 'object') return packFile(value)
  if (typeof value === 'string') return value
  throw new Error('Invalid media input')
}

export function clearWorkshopFiles(schema: readonly FieldSchema[]): FormValues {
  return Object.fromEntries(
    schema
      .filter((field) => field.kind === 'file' || urlUploadField(field))
      .map((field) => [field.name, undefined])
  )
}

export function packWorkshopFiles(
  schema: readonly FieldSchema[],
  values: FormValues
): DraftFiles {
  const files = Object.fromEntries(
    schema
      .filter((field) => field.kind === 'file' || urlUploadField(field))
      .map((field) => [field.name, packValue(values[field.name])])
  )
  const bytes = Object.values(files)
    .flat()
    .reduce(
      (size, file) =>
        size +
        (file instanceof File
          ? file.size
          : typeof file === 'string'
            ? file.length * 2
            : 0),
      0
    )
  if (bytes > MAX_DRAFT_BYTES) throw new Error('Draft exceeds storage limit')
  return files
}

function unpackFile(field: FieldSchema, value: unknown): FileValue | undefined {
  if (typeof value === 'string' && value.startsWith('data:')) {
    const media = routerMediaValue(field, value)
    return Array.isArray(media)
      ? media[0]
      : media && typeof media === 'object'
        ? media
        : undefined
  }
  if (value instanceof File)
    return { file: value, name: value.name, size: value.size, type: value.type }
  return typeof value === 'string' ? workshopExampleFile(value) : undefined
}

function unpackValue(field: FieldSchema, value: unknown): FieldValue {
  if (value === null) return undefined
  if (
    field.kind !== 'file' &&
    typeof value === 'string' &&
    !value.startsWith('data:')
  )
    return workshopExampleFile(value) ? value : undefined
  if (!Array.isArray(value)) return unpackFile(field, value)
  const files = value.map((item) => unpackFile(field, item))
  if (files.some((file) => file === undefined)) return undefined
  return files.filter((file) => file !== undefined)
}

export function restoreWorkshopFiles(
  schema: readonly FieldSchema[],
  stored: unknown
): FormValues {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored))
    throw new Error('Missing media draft')
  const files: Record<string, FieldValue> = {}
  for (const field of schema) {
    if (field.kind !== 'file' && !urlUploadField(field)) continue
    if (!Object.hasOwn(stored, field.name)) continue
    const value: unknown = Object.getOwnPropertyDescriptor(
      stored,
      field.name
    )?.value
    const restored = unpackValue(field, value)
    if (
      value !== null &&
      (restored === undefined ||
        Object.keys(validateForm([field], { [field.name]: restored })).length)
    )
      throw new Error('Invalid media draft')
    files[field.name] = restored
  }
  return files
}

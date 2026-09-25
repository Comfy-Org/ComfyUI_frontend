import type { FieldSchema, FieldValue, FormValues } from './workshop-playground'
import {
  readWorkshopImageMetadata,
  readWorkshopVideoMetadata
} from './workshop-media-metadata'
import type {
  WorkshopImageMetadata,
  WorkshopVideoMetadata
} from './workshop-media-metadata'
import { WorkshopRouterError } from './workshop-router-errors'

function mediaSource(value: FieldValue): File | string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && !Array.isArray(value))
    return value.file ?? value.sourceUrl ?? value.sourceDataUrl
  return undefined
}

async function videoMetadata(
  file: FieldValue,
  name: string,
  signal: AbortSignal
): Promise<WorkshopVideoMetadata> {
  const source = mediaSource(file)
  try {
    if (!source) throw new TypeError('Missing video source')
    return await readWorkshopVideoMetadata(source, signal)
  } catch (cause) {
    signal.throwIfAborted()
    const missingSelectedFile =
      source === undefined && typeof file === 'object' && !Array.isArray(file)
    const code =
      (source !== undefined && typeof source !== 'string') ||
      missingSelectedFile
        ? 'fileUnreadable'
        : 'videoUnreadable'
    throw new WorkshopRouterError(
      'client',
      null,
      { [name]: code },
      undefined,
      'input_preparation',
      { cause }
    )
  }
}

async function imageMetadata(
  file: FieldValue,
  name: string,
  signal: AbortSignal
): Promise<WorkshopImageMetadata> {
  const source = mediaSource(file)
  try {
    if (!source) throw new TypeError('Missing image source')
    return await readWorkshopImageMetadata(source, signal)
  } catch (cause) {
    signal.throwIfAborted()
    const missingSelectedFile =
      source === undefined && typeof file === 'object' && !Array.isArray(file)
    const code =
      (source !== undefined && typeof source !== 'string') ||
      missingSelectedFile
        ? 'fileUnreadable'
        : 'imageUnreadable'
    throw new WorkshopRouterError(
      'client',
      null,
      { [name]: code },
      undefined,
      'input_preparation',
      { cause }
    )
  }
}

function validationError(
  name: string,
  code: 'imageAspectRatioOutOfRange' | 'videoTooLong' | 'videoWidthOutOfRange'
): WorkshopRouterError {
  return new WorkshopRouterError(
    'validation',
    null,
    { [name]: code },
    undefined,
    'input_preparation'
  )
}

function validateImageMetadata(
  field: FieldSchema,
  metadata: WorkshopImageMetadata
): void {
  const range = field.presentation?.imageAspectRatio
  if (!range) return
  const ratio = metadata.widthPixels / metadata.heightPixels
  if (ratio < range.minimum || ratio > range.maximum)
    throw validationError(field.name, 'imageAspectRatioOutOfRange')
}

function validateVideoMetadata(
  field: FieldSchema,
  metadata: WorkshopVideoMetadata
): void {
  const maximumDuration = field.presentation?.maxVideoDurationSeconds
  if (
    maximumDuration !== undefined &&
    metadata.durationSeconds > maximumDuration
  )
    throw validationError(field.name, 'videoTooLong')

  const width = field.presentation?.videoWidthPixels
  if (
    width &&
    (metadata.widthPixels < width.minimum ||
      metadata.widthPixels > width.maximum)
  )
    throw validationError(field.name, 'videoWidthOutOfRange')
}

function hasMediaConstraint(field: FieldSchema): boolean {
  const presentation = field.presentation
  if (!presentation) return false
  return (
    presentation.maxVideoDurationSeconds !== undefined ||
    presentation.videoWidthPixels !== undefined ||
    presentation.imageAspectRatio !== undefined
  )
}

function constrainedMediaValues(
  field: FieldSchema,
  values: FormValues
): readonly FieldValue[] {
  if (!hasMediaConstraint(field)) return []
  const value = values[field.name]
  if (value === undefined) return []
  if (value === '') return []
  return Array.isArray(value) ? value : [value]
}

export async function validateWorkshopMediaInputs(
  schema: readonly FieldSchema[],
  values: FormValues,
  signal: AbortSignal
): Promise<void> {
  for (const field of schema) {
    for (const file of constrainedMediaValues(field, values)) {
      if (field.presentation?.imageAspectRatio)
        validateImageMetadata(
          field,
          await imageMetadata(file, field.name, signal)
        )
      else
        validateVideoMetadata(
          field,
          await videoMetadata(file, field.name, signal)
        )
    }
  }
}

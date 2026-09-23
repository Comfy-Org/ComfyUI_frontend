import type { FieldSchema, FieldValue, FormValues } from './workshop-playground'
import { readWorkshopVideoMetadata } from './workshop-media-metadata'
import type { WorkshopVideoMetadata } from './workshop-media-metadata'
import { WorkshopRouterError } from './workshop-router-errors'

function videoSource(value: FieldValue): File | string | undefined {
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
  try {
    const source = videoSource(file)
    if (!source) throw new TypeError('Missing video source')
    return await readWorkshopVideoMetadata(source, signal)
  } catch (cause) {
    signal.throwIfAborted()
    throw new WorkshopRouterError(
      'client',
      null,
      { [name]: 'videoUnreadable' },
      undefined,
      'input_preparation',
      { cause }
    )
  }
}

function validationError(
  name: string,
  code: 'videoTooLong' | 'videoWidthOutOfRange'
): WorkshopRouterError {
  return new WorkshopRouterError(
    'validation',
    null,
    { [name]: code },
    undefined,
    'input_preparation'
  )
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

function constrainedMediaValues(
  field: FieldSchema,
  values: FormValues
): readonly FieldValue[] {
  const presentation = field.presentation
  if (
    presentation?.maxVideoDurationSeconds === undefined &&
    presentation?.videoWidthPixels === undefined
  )
    return []
  const value = values[field.name]
  if (value === undefined || value === '') return []
  return Array.isArray(value) ? value : [value]
}

export async function validateWorkshopMediaInputs(
  schema: readonly FieldSchema[],
  values: FormValues,
  signal: AbortSignal
): Promise<void> {
  for (const field of schema) {
    for (const file of constrainedMediaValues(field, values))
      validateVideoMetadata(
        field,
        await videoMetadata(file, field.name, signal)
      )
  }
}

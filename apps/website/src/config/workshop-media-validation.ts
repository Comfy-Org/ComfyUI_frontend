import type { FieldSchema, FieldValue, FormValues } from './workshop-playground'
import { readWorkshopVideoDuration } from './workshop-media-metadata'
import { WorkshopRouterError } from './workshop-router-errors'

function videoSource(value: FieldValue): File | string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && !Array.isArray(value))
    return value.file ?? value.sourceUrl ?? value.sourceDataUrl
  return undefined
}

async function videoDuration(
  file: FieldValue,
  name: string,
  signal: AbortSignal
): Promise<number> {
  try {
    const source = videoSource(file)
    if (!source) throw new TypeError('Missing video source')
    return await readWorkshopVideoDuration(source, signal)
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

export async function validateWorkshopMediaInputs(
  schema: readonly FieldSchema[],
  values: FormValues,
  signal: AbortSignal
): Promise<void> {
  for (const field of schema) {
    const maximum = field.presentation?.maxVideoDurationSeconds
    const value = values[field.name]
    if (maximum === undefined || value === undefined || value === '') continue
    for (const file of Array.isArray(value) ? value : [value]) {
      const duration = await videoDuration(file, field.name, signal)
      if (duration > maximum)
        throw new WorkshopRouterError(
          'validation',
          null,
          { [field.name]: 'videoTooLong' },
          undefined,
          'input_preparation'
        )
    }
  }
}

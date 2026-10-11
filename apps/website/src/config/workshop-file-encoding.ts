import { WorkshopRouterError } from './workshop-router-errors'

export async function readWorkshopFile(
  file: Blob,
  signal: AbortSignal,
  fieldName: string
): Promise<ArrayBuffer> {
  signal.throwIfAborted()
  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch (cause) {
    signal.throwIfAborted()
    throw new WorkshopRouterError(
      'client',
      null,
      { [fieldName]: 'fileUnreadable' },
      undefined,
      'file_read',
      { cause }
    )
  }
  signal.throwIfAborted()
  return buffer
}

export async function workshopFileBase64(
  file: File,
  signal: AbortSignal,
  fieldName: string
): Promise<string> {
  const buffer = await readWorkshopFile(file, signal, fieldName)
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return btoa(binary)
}

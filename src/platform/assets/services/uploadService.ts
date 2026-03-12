import type { ResultItemType } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import type { ImageRef } from '@/stores/maskEditorDataStore'

interface UploadInput {
  source: File | Blob | string
  filename?: string
}

interface UploadConfig {
  subfolder?: string
  type?: ResultItemType
  endpoint?: '/upload/image' | '/upload/mask'
  originalRef?: ImageRef
  maxSizeMB?: number
}

interface UploadApiResponse {
  name: string
  subfolder?: string
  type?: string
}

interface UploadResult {
  success: boolean
  path: string
  name: string
  subfolder: string
  error?: string
  response: UploadApiResponse | null
}

function isDataURL(str: string): boolean {
  return typeof str === 'string' && str.startsWith('data:')
}

async function convertToFile(
  input: UploadInput,
  mimeType: string = 'image/png'
): Promise<File> {
  const { source, filename } = input

  if (source instanceof File) {
    return source
  }

  if (source instanceof Blob) {
    const name = filename || `upload-${Date.now()}.png`
    return new File([source], name, { type: source.type || mimeType })
  }

  // dataURL string
  if (!isDataURL(source)) {
    throw new Error('Invalid data URL')
  }

  try {
    const blob = await fetch(source).then((r) => r.blob())
    const name = filename || `upload-${Date.now()}.png`
    return new File([blob], name, { type: mimeType })
  } catch (error) {
    throw new Error(
      `Failed to convert data URL to file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function validateFileSize(file: File, maxSizeMB?: number): string | null {
  if (!maxSizeMB) return null

  const fileSizeMB = file.size / 1024 / 1024
  if (fileSizeMB > maxSizeMB) {
    return `File size ${fileSizeMB.toFixed(1)}MB exceeds maximum ${maxSizeMB}MB`
  }

  return null
}

export async function uploadMedia(
  input: UploadInput,
  config: UploadConfig = {}
): Promise<UploadResult> {
  const {
    subfolder,
    type,
    endpoint = '/upload/image',
    originalRef,
    maxSizeMB
  } = config

  try {
    const file = await convertToFile(input)

    const sizeError = validateFileSize(file, maxSizeMB)
    if (sizeError) {
      return {
        success: false,
        path: '',
        name: '',
        subfolder: '',
        error: sizeError,
        response: null
      }
    }

    const body = new FormData()
    body.append('image', file)
    if (subfolder) body.append('subfolder', subfolder)
    if (type) body.append('type', type)
    if (originalRef) body.append('original_ref', JSON.stringify(originalRef))

    const resp = await api.fetchApi(endpoint, {
      method: 'POST',
      body
    })

    if (resp.status !== 200) {
      return {
        success: false,
        path: '',
        name: '',
        subfolder: '',
        error: `${resp.status} - ${resp.statusText}`,
        response: null
      }
    }

    const data: UploadApiResponse = await resp.json()
    const path = data.subfolder ? `${data.subfolder}/${data.name}` : data.name

    return {
      success: true,
      path,
      name: data.name,
      subfolder: data.subfolder || '',
      response: data
    }
  } catch (error) {
    return {
      success: false,
      path: '',
      name: '',
      subfolder: '',
      error: error instanceof Error ? error.message : String(error),
      response: null
    }
  }
}

export async function uploadMediaBatch(
  inputs: UploadInput[],
  config: UploadConfig = {}
): Promise<UploadResult[]> {
  return Promise.all(inputs.map((input) => uploadMedia(input, config)))
}

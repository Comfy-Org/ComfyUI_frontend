import { api } from '@/scripts/api'

import { ComfyApiError } from './errors'

export type ModelFolder =
  | 'checkpoints'
  | 'clip'
  | 'clip_vision'
  | 'controlnet'
  | 'diffusion_models'
  | 'embeddings'
  | 'loras'
  | 'text_encoders'
  | 'unet'
  | 'upscale_models'
  | 'vae'

const MODEL_FOLDERS: readonly ModelFolder[] = [
  'checkpoints',
  'clip',
  'clip_vision',
  'controlnet',
  'diffusion_models',
  'embeddings',
  'loras',
  'text_encoders',
  'unet',
  'upscale_models',
  'vae'
]

export type ModelSidecarSuffix = '.md' | '.txt'

export interface ModelsHandle {
  /** Lists registered logical names without exposing model paths. */
  list(folder: ModelFolder): Promise<string[]>
  /** Reads a bounded UTF-8 sidecar next to a registered model. */
  readSidecar(
    folder: ModelFolder,
    modelName: string,
    suffix: ModelSidecarSuffix
  ): Promise<string | undefined>
}

const folders = new Set<string>(MODEL_FOLDERS)
const suffixes = new Set<string>(['.md', '.txt'])
const maxModelNameLength = 1024
const maxSidecarBytes = 64 * 1024

function assertFolder(folder: string): asserts folder is ModelFolder {
  if (!folders.has(folder)) {
    throw new ComfyApiError(`Unknown model folder '${folder}'.`)
  }
}

function validModelName(modelName: unknown): modelName is string {
  if (
    typeof modelName !== 'string' ||
    modelName.length < 1 ||
    modelName.length > maxModelNameLength ||
    Array.from(modelName).some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    }) ||
    modelName.startsWith('/') ||
    modelName.startsWith('\\') ||
    /^[A-Za-z]:[\\/]/.test(modelName)
  ) {
    return false
  }
  return modelName
    .split(/[\\/]/)
    .every((part) => part.length > 0 && part !== '.' && part !== '..')
}

function assertModelName(modelName: unknown): asserts modelName is string {
  if (!validModelName(modelName)) {
    throw new ComfyApiError('Model name must be a bounded logical name.')
  }
}

function assertSuffix(suffix: string): asserts suffix is ModelSidecarSuffix {
  if (!suffixes.has(suffix)) {
    throw new ComfyApiError(`Unsupported model sidecar suffix '${suffix}'.`)
  }
}

async function checkedJson(
  response: Response,
  operation: string
): Promise<unknown> {
  if (!response.ok) {
    throw new ComfyApiError(`${operation} failed with HTTP ${response.status}.`)
  }
  return await response.json()
}

export function createModelsApi(): ModelsHandle {
  const handle: ModelsHandle = {
    async list(folder) {
      assertFolder(folder)
      const value = await checkedJson(
        await api.fetchApi(
          `/secure-nodes/models/${encodeURIComponent(folder)}`
        ),
        'Model listing'
      )
      if (
        !Array.isArray(value) ||
        value.length > 4096 ||
        value.some((name) => !validModelName(name))
      ) {
        throw new ComfyApiError('Model listing returned an invalid response.')
      }
      return value.slice()
    },

    async readSidecar(folder, modelName, suffix) {
      assertFolder(folder)
      assertModelName(modelName)
      assertSuffix(suffix)
      const query = new URLSearchParams({ name: modelName, suffix })
      const response = await api.fetchApi(
        `/secure-nodes/model-sidecar/${encodeURIComponent(folder)}?${query}`
      )
      if (response.status === 404) return undefined
      const value = await checkedJson(response, 'Model sidecar read')
      if (
        typeof value !== 'object' ||
        value === null ||
        !('content' in value) ||
        typeof value.content !== 'string' ||
        new TextEncoder().encode(value.content).byteLength > maxSidecarBytes
      ) {
        throw new ComfyApiError('Model sidecar returned an invalid response.')
      }
      return value.content
    }
  }
  return Object.freeze(handle)
}

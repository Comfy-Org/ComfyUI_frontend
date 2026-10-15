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
  | 'ipadapter'
  | 'vae_approx'

export interface ModelsHandle {
  /**
   * Lists at most 50,000 distinct logical model names from a known folder.
   * The host chooses the route; filesystem locations and path indexes are
   * excluded. Unknown folders, invalid replies and HTTP failures reject.
   */
  list(folder: ModelFolder): Promise<string[]>
}

const MODEL_FOLDERS: ReadonlySet<ModelFolder> = new Set([
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
  'vae',
  'ipadapter',
  'vae_approx'
])

function isModelName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 1024 &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    }) &&
    !/^[/\\]/.test(value) &&
    !/^[a-z]:/i.test(value) &&
    !value.split(/[/\\]/).includes('..')
  )
}

function modelNames(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 50000 ||
    !value.every(isModelName)
  ) {
    throw new ComfyApiError('Model listing returned an invalid response.')
  }
  return [...new Set(value)]
}

function isLibraryEntry(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function checkedJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new ComfyApiError(
      `Model listing failed with HTTP ${response.status}.`
    )
  }
  try {
    return await response.json()
  } catch {
    throw new ComfyApiError('Model listing returned an invalid response.')
  }
}

export function createModelsApi(): ModelsHandle {
  return Object.freeze({
    async list(folder: ModelFolder) {
      if (!MODEL_FOLDERS.has(folder)) {
        throw new ComfyApiError('Unknown model folder.')
      }
      const init = { method: 'GET', cache: 'no-store' } as const
      const library = await api.fetchApi(`/experiment/models/${folder}`, init)
      if (library.status === 404) {
        return modelNames(
          await checkedJson(await api.fetchApi(`/models/${folder}`, init))
        )
      }
      const value = await checkedJson(library)
      if (
        !Array.isArray(value) ||
        value.length > 50000 ||
        !value.every(isLibraryEntry)
      ) {
        throw new ComfyApiError('Model listing returned an invalid response.')
      }
      return modelNames(value.map((entry) => entry.name))
    }
  })
}

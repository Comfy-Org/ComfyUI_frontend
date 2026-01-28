import type { ComfyModelDef } from '@/stores/modelStore'
import type { EnrichedModel } from '@/types/modelBrowserTypes'

/**
 * Format folder name to display badge
 * Converts folder name to uppercase badge text
 */
export function formatModelTypeBadge(folderName: string): string {
  const badges: Record<string, string> = {
    checkpoints: 'CHECKPOINT',
    loras: 'LORA',
    vae: 'VAE',
    controlnet: 'CONTROLNET',
    embeddings: 'EMBEDDING',
    upscale_models: 'UPSCALE',
    clip_vision: 'CLIP VISION',
    ipadapter: 'IP-ADAPTER',
    sams: 'SAM',
    diffusion_models: 'DIFFUSION',
    animatediff_models: 'ANIMATEDIFF',
    animatediff_motion_lora: 'MOTION LORA',
    audio_encoders: 'AUDIO',
    clip: 'CLIP',
    unet: 'UNET',
    gligen: 'GLIGEN',
    style_models: 'STYLE',
    photomaker: 'PHOTOMAKER'
  }
  return badges[folderName] || folderName.toUpperCase().replace(/_/g, ' ')
}

/**
 * Generate preview URL for a model
 * Format: /api/experiment/models/preview/{folder}/{pathIndex}/{encodedFilename}
 */
export function getPreviewUrl(model: EnrichedModel): string {
  const encodedFilename = encodeURIComponent(model.fileName)
  return `/api/experiment/models/preview/${model.directory}/${model.pathIndex}/${encodedFilename}`
}

/**
 * Transform ComfyModelDef to EnrichedModel for UI display
 */
export function transformToEnrichedModel(
  model: ComfyModelDef,
  folderName?: string
): EnrichedModel {
  const directory = folderName || model.directory
  const extension = model.file_name.split('.').pop()
  const format =
    extension && extension !== model.file_name ? extension : 'unknown'

  const enriched: EnrichedModel = {
    id: model.key,
    key: model.key,
    fileName: model.file_name,
    simplifiedName: model.simplified_file_name,
    directory: model.directory,
    displayName: model.title || model.simplified_file_name,
    type: formatModelTypeBadge(directory),
    format: format,
    pathIndex: model.path_index,
    original: model
  }

  // Add lazy-loaded metadata if available
  if (model.has_loaded_metadata) {
    enriched.description = model.description || undefined
    enriched.tags = model.tags.length > 0 ? model.tags : undefined
    enriched.author = model.author || undefined
    enriched.architectureId = model.architecture_id || undefined
    enriched.resolution = model.resolution || undefined
    enriched.usageHint = model.usage_hint || undefined
    enriched.triggerPhrase = model.trigger_phrase || undefined
  }

  // Set preview URL
  enriched.previewUrl = getPreviewUrl(enriched)

  return enriched
}

/**
 * Load metadata for an enriched model
 * Calls the original model's load() method and returns updated enriched model
 * Returns a new object to maintain immutability
 */
export async function loadModelMetadata(
  model: EnrichedModel
): Promise<EnrichedModel> {
  await model.original.load()

  // Return new enriched model with loaded metadata (immutable)
  return {
    ...model,
    description: model.original.description || undefined,
    tags: model.original.tags.length > 0 ? model.original.tags : undefined,
    author: model.original.author || undefined,
    architectureId: model.original.architecture_id || undefined,
    resolution: model.original.resolution || undefined,
    usageHint: model.original.usage_hint || undefined,
    triggerPhrase: model.original.trigger_phrase || undefined,
    displayName: model.original.title || model.simplifiedName
  }
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return 'N/A'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

/**
 * Format timestamp to human-readable date string
 */
export function formatModifiedDate(timestamp?: number): string {
  if (timestamp === undefined) return 'N/A'

  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

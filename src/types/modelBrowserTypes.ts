import type { ComfyModelDef } from '@/stores/modelStore'

/**
 * Enriched model interface for UI display
 * Transforms ComfyModelDef into a more UI-friendly format
 */
export interface EnrichedModel {
  /** Unique identifier: `${directory}/${normalized_file_name}` */
  id: string
  /** Key from ComfyModelDef */
  key: string
  /** Full file name including extension */
  fileName: string
  /** Simplified file name without path and .safetensors extension */
  simplifiedName: string
  /** File format/extension (e.g., 'safetensors', 'ckpt', 'pt') */
  format: string
  /** Directory/folder name (e.g., 'checkpoints', 'loras') */
  directory: string
  /** Display name (from metadata title or simplified name) */
  displayName: string
  /** Model type badge for UI (e.g., 'CHECKPOINT', 'LORA') */
  type: string
  /** Path index for the model */
  pathIndex: number

  // Optional metadata (may not be available for all models)
  /** File size in bytes (local only) */
  size?: number
  /** Modified timestamp in Unix time (local only) */
  modified?: number

  // Lazy-loaded metadata (populated after model.load())
  /** Model description */
  description?: string
  /** Preview image URL */
  previewUrl?: string
  /** Model tags */
  tags?: string[]
  /** Model author */
  author?: string
  /** Architecture ID (e.g., 'stable-diffusion-xl-v1-base') */
  architectureId?: string
  /** Resolution (e.g., '1024x1024') */
  resolution?: string
  /** Usage hint */
  usageHint?: string
  /** Trigger phrase */
  triggerPhrase?: string

  /** Reference to original ComfyModelDef */
  original: ComfyModelDef
}

/**
 * Model browser filter options
 */
export interface ModelBrowserFilters {
  /** Search query string */
  searchQuery?: string
  /** Selected model type (directory name) */
  modelType?: string | null
  /** Sort field */
  sortBy?: 'name' | 'size' | 'modified'
  /** Sort direction */
  sortDirection?: 'asc' | 'desc'
}

/**
 * Options for opening the model browser dialog
 */
export interface ModelBrowserDialogOptions {
  /** Initial model type to select */
  initialModelType?: string
  /** Callback when a model is selected */
  onModelSelected?: (model: ComfyModelDef) => void
  /** Callback when dialog is closed */
  onClose?: () => void
}

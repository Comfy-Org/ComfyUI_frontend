// Re-exports from the platform layer for use by the legacy missing-models dialog
export {
  downloadModel,
  isModelDownloadable,
  fetchModelMetadata,
  hasValidDirectory,
  type ModelWithUrl
} from '@/platform/missingModel/missingModelDownload'

// Legacy-only utility: maps model directory names to badge labels for
// MissingModelsContent.vue display. Only used by the legacy dialog.
const DIRECTORY_BADGE_MAP = {
  vae: 'VAE',
  diffusion_models: 'DIFFUSION',
  text_encoders: 'TEXT ENCODER',
  loras: 'LORA',
  checkpoints: 'CHECKPOINT'
} as const

export function getBadgeLabel(directory: string): string {
  if (directory in DIRECTORY_BADGE_MAP) {
    return DIRECTORY_BADGE_MAP[directory as keyof typeof DIRECTORY_BADGE_MAP]
  }
  return directory.toUpperCase()
}

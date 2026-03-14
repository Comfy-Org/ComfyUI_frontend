export {
  downloadModel,
  isModelDownloadable,
  fetchModelMetadata,
  hasValidDirectory,
  type ModelWithUrl
} from '@/platform/missingModel/missingModelDownload'

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

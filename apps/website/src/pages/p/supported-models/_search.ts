import type { Model } from '../../../config/models'

export const directoryLabel: Partial<Record<Model['directory'], string>> = {
  diffusion_models: 'Diffusion',
  checkpoints: 'Checkpoint',
  loras: 'LoRA',
  controlnet: 'ControlNet',
  clip_vision: 'CLIP Vision',
  model_patches: 'Patch',
  vae: 'VAE',
  text_encoders: 'Text Encoder',
  audio_encoders: 'Audio Encoder',
  latent_upscale_models: 'Latent Upscale',
  upscale_models: 'Upscale',
  style_models: 'Style',
  partner_nodes: 'Partner Node'
}

export function modelSearchText(
  model: Pick<Model, 'displayName' | 'name' | 'slug' | 'directory'>
): string {
  const label = directoryLabel[model.directory] ?? model.directory
  return `${model.displayName} ${model.name} ${model.slug} ${label}`.toLowerCase()
}

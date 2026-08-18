// Shared model-page prose: one source for the HTML page and its markdown twin
// (/p/supported-models/[slug] and /p/supported-models/[slug].md), so the two
// surfaces cannot drift.
import type { models } from './models'

type Model = (typeof models)[number]

const dirDescriptions: Record<string, string> = {
  diffusion_models:
    'a diffusion model that generates images or video from text and image prompts',
  checkpoints:
    'an all-in-one checkpoint model that bundles a diffusion model, text encoder, and VAE',
  loras:
    'a LoRA (Low-Rank Adaptation) that fine-tunes an existing model for a specific style or subject',
  controlnet:
    'a ControlNet that steers image generation using structural guides like depth maps, edges, or poses',
  clip_vision:
    'a CLIP Vision encoder that converts images into embeddings for conditioning or style transfer',
  vae: 'a VAE (Variational Autoencoder) that encodes and decodes latent representations',
  text_encoders:
    'a text encoder that converts prompts into embeddings used to guide generation',
  audio_encoders:
    'an audio encoder that converts audio into embeddings for audio-conditioned generation',
  upscale_models:
    'an upscale model that increases image resolution while preserving or enhancing detail',
  latent_upscale_models:
    'a latent upscale model that refines latents at higher resolution before decoding',
  style_models:
    'a style model that transfers artistic style onto generated images',
  model_patches:
    'a model patch that modifies or extends the behavior of an existing base model',
  geometry_estimation:
    'a geometry estimation model that predicts depth, normals, or 3D structure from images',
  background_removal:
    'a background removal model that separates subjects from their backgrounds',
  detection:
    'a detection model that locates faces, objects, or landmarks in images',
  frame_interpolation:
    'a frame interpolation model that synthesizes intermediate frames for smoother video',
  optical_flow:
    'an optical flow model that estimates per-pixel motion between video frames',
  partner_nodes:
    'a cloud API model accessible through ComfyUI partner nodes without local hardware requirements'
}

export const dirLabels: Record<string, string> = {
  diffusion_models: 'Diffusion model',
  checkpoints: 'Checkpoint',
  loras: 'LoRA',
  controlnet: 'ControlNet',
  clip_vision: 'CLIP Vision encoder',
  model_patches: 'Model patch',
  vae: 'VAE',
  text_encoders: 'Text encoder',
  audio_encoders: 'Audio encoder',
  latent_upscale_models: 'Latent upscale model',
  upscale_models: 'Upscale model',
  style_models: 'Style model',
  geometry_estimation: 'Geometry estimation model',
  background_removal: 'Background removal model',
  detection: 'Detection model',
  frame_interpolation: 'Frame interpolation model',
  optical_flow: 'Optical flow model',
  partner_nodes: 'Partner node'
}

export function isPartnerModel(model: Model): boolean {
  return model.directory === 'partner_nodes'
}

export function buildWhatIsDescription(model: Model): string {
  const dirDesc = dirDescriptions[model.directory] ?? 'an AI model'
  const access = isPartnerModel(model)
    ? `You can run it in ComfyUI through partner nodes — inference runs on the provider's API, so no local weights or GPU are required.`
    : `You can run it locally in ComfyUI with full control over every parameter, or access it through Comfy Cloud.`
  const templateCount =
    model.workflowCount === 1
      ? 'There is 1 community workflow template'
      : `There are ${model.workflowCount} community workflow templates`
  return `${model.displayName} is ${dirDesc}. ${access} ComfyUI's node-based workflow editor lets you connect ${model.displayName} with ControlNets, LoRAs, upscalers, and custom nodes to build any pipeline you need. ${templateCount} using ${model.displayName} on Comfy Workflows, ready to load and customize.`
}

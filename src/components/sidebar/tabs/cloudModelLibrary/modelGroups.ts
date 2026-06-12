import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { formatCategoryLabel } from '@/platform/assets/utils/categoryLabel'

import { COMFY_ORG_PROVIDER_OVERRIDES } from './comfyOrgProviderOverrides'

/** @knipIgnoreUsedByStackedPR */
export const PARTNER_NODES_GROUP_ID = 'partner-nodes'
export const UNKNOWN_PROVIDER = '—'

interface ModelGroupDef {
  id: string
  label: string
  /** Raw category tags from the assets API that belong in this group. */
  tags: readonly string[]
}

/** @knipIgnoreUsedByStackedPR */
export const MODEL_GROUPS: readonly ModelGroupDef[] = [
  { id: 'loras', label: 'LoRAs', tags: ['loras'] },
  {
    id: 'diffusion',
    label: 'Diffusion models',
    tags: ['diffusion_models', 'checkpoints', 'diffusers', 'UltraShape']
  },
  { id: 'language', label: 'Language models', tags: ['LLM', 'smol'] },
  {
    id: 'captioning',
    label: 'Captioning / VLM',
    tags: ['florence2', 'Joy_caption', 'superprompt-v1']
  },
  {
    id: 'audio',
    label: 'TTS & audio',
    tags: ['qwen-tts', 'chatterbox', 'audio_encoders']
  },
  {
    id: 'encoders',
    label: 'Encoders',
    tags: ['text_encoders', 'clip', 'clip_vision']
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    tags: [
      'controlnet',
      'ipadapter',
      'gligen',
      'style_models',
      'model_patches',
      'inpaint'
    ]
  },
  {
    id: 'segmentation',
    label: 'Segmentation',
    tags: [
      'sams',
      'sam2',
      'sam3',
      'sam3d',
      'sam3dbody',
      'EVF-SAM',
      'segformer_b3_fashion',
      'segformer_b3_clothes',
      'segformer_b2_clothes',
      'face_parsing'
    ]
  },
  {
    id: 'video',
    label: 'Video & motion',
    tags: [
      'CogVideo',
      'liveportrait',
      'mimicmotion',
      'latentsync',
      'animatediff_models',
      'animatediff_motion_lora'
    ]
  },
  {
    id: 'upscale',
    label: 'Upscale / restore / interpolate',
    tags: [
      'upscale_models',
      'latent_upscale_models',
      'FlashVSR',
      'FlashVSR-v1.1',
      'SEEDVR2',
      'rife',
      'film',
      'frame_interpolation',
      'interpolation',
      'optical_flow',
      'onnx',
      'sharp'
    ]
  },
  {
    id: 'background',
    label: 'Background, matting & layers',
    tags: [
      'BiRefNet',
      'BEN',
      'transparent-background',
      'lama',
      'rmbg',
      'background_removal',
      'vitmatte',
      'vitmatte-base-composition-1k',
      'layerstyle',
      'layer_model'
    ]
  },
  { id: 'vae', label: 'VAEs', tags: ['vae', 'vae_approx'] },
  {
    id: 'depth',
    label: 'Depth & geometry',
    tags: ['depthanything', 'depthanything3', 'geometry_estimation']
  },
  {
    id: 'detection',
    label: 'Detection / pose',
    tags: [
      'yolo',
      'dwpose',
      'ultralytics',
      'detection',
      'mediapipe',
      'grounding-dino',
      'nlf'
    ]
  },
  { id: PARTNER_NODES_GROUP_ID, label: 'Partner nodes', tags: [] }
] as const

const TAG_TO_GROUP_ID = (() => {
  const map = new Map<string, string>()
  for (const group of MODEL_GROUPS) {
    for (const tag of group.tags) map.set(tag, group.id)
  }
  return map
})()

/**
 * Maps a raw asset category tag (e.g. "loras", "sam3d") to a group id.
 * Returns null if the tag is unmapped — caller should render a fallback
 * section keyed on the raw tag so new categories surface immediately.
 * @knipIgnoreUsedByStackedPR
 */
export function groupIdForRawTag(rawTag: string): string | null {
  return TAG_TO_GROUP_ID.get(rawTag) ?? null
}

/**
 * Extracts the provider segment from a partner-node category string.
 * Example: "api node/image/BFL" -> "BFL".
 * @knipIgnoreUsedByStackedPR
 */
export function formatPartnerProvider(category: string | undefined): string {
  if (!category) return ''
  const parts = category.split('/')
  return parts[parts.length - 1] ?? ''
}

/** @knipIgnoreUsedByStackedPR */
export function isPartnerNodeCategory(category: string | undefined): boolean {
  if (!category) return false
  return category.toLowerCase().startsWith('api node')
}

/** @knipIgnoreUsedByStackedPR */
export function fallbackGroupLabel(rawTag: string): string {
  return formatCategoryLabel(rawTag)
}

/**
 * Compact display name for a row:
 *   - Drops anything before the first '/' (provider prefix like "microsoft/").
 *   - Replaces hyphens between non-space characters with spaces.
 *     "Florence-2-large" -> "Florence 2 large"
 *   - Hyphens with a space on either side (" - ") are preserved.
 *   - Replaces underscores with spaces ("t5gemma_b_b_ul2" -> "t5gemma b b ul2").
 * @knipIgnoreUsedByStackedPR
 */
export function formatRowDisplayName(raw: string): string {
  const slashIdx = raw.indexOf('/')
  const afterProvider = slashIdx >= 0 ? raw.slice(slashIdx + 1) : raw
  return afterProvider.replace(/(?<=\S)-(?=\S)/g, ' ').replace(/_/g, ' ')
}

/**
 * Returns the HuggingFace-style organisation prefix from an asset's repo_id
 * (e.g. "Comfy-Org/stable-audio-3" -> "Comfy-Org"), or [[UNKNOWN_PROVIDER]] if
 * no provider can be inferred.
 */
export function getAssetProvider(asset: AssetItem): string {
  return (
    resolveProvider(asset.metadata?.['repo_id']) ??
    resolveProvider(asset.user_metadata?.['repo_id']) ??
    resolveAuthorField(asset.metadata?.['author']) ??
    resolveAuthorField(asset.user_metadata?.['author']) ??
    UNKNOWN_PROVIDER
  )
}

function resolveAuthorField(author: unknown): string | null {
  if (typeof author !== 'string') return null
  const trimmed = author.trim()
  return trimmed.length > 0 ? trimmed : null
}

function resolveProvider(repoId: unknown): string | null {
  if (typeof repoId !== 'string' || !repoId) return null
  return COMFY_ORG_PROVIDER_OVERRIDES[repoId] ?? getRepoOrg(repoId)
}

function getRepoOrg(repoId: unknown): string | null {
  if (typeof repoId !== 'string' || !repoId) return null
  const org = repoId.split('/')[0]
  return org && org.length > 0 ? org : null
}

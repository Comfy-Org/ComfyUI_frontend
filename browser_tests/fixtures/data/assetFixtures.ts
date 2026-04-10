import type { Asset } from '@comfyorg/ingest-types'
function createModelAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'test-model-001',
    name: 'model.safetensors',
    asset_hash:
      'blake3:0000000000000000000000000000000000000000000000000000000000000000',
    size: 2_147_483_648,
    mime_type: 'application/octet-stream',
    tags: ['models', 'checkpoints'],
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    last_access_time: '2025-01-15T10:00:00Z',
    user_metadata: { base_model: 'sd15' },
    ...overrides
  }
}

function createInputAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'test-input-001',
    name: 'input.png',
    asset_hash:
      'blake3:1111111111111111111111111111111111111111111111111111111111111111',
    size: 2_048_576,
    mime_type: 'image/png',
    tags: ['input'],
    created_at: '2025-03-01T09:00:00Z',
    updated_at: '2025-03-01T09:00:00Z',
    last_access_time: '2025-03-01T09:00:00Z',
    ...overrides
  }
}

function createOutputAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'test-output-001',
    name: 'output_00001.png',
    asset_hash:
      'blake3:2222222222222222222222222222222222222222222222222222222222222222',
    size: 4_194_304,
    mime_type: 'image/png',
    tags: ['output'],
    created_at: '2025-03-10T12:00:00Z',
    updated_at: '2025-03-10T12:00:00Z',
    last_access_time: '2025-03-10T12:00:00Z',
    ...overrides
  }
}
export const STABLE_CHECKPOINT: Asset = createModelAsset({
  id: 'test-checkpoint-001',
  name: 'sd_xl_base_1.0.safetensors',
  size: 6_938_078_208,
  tags: ['models', 'checkpoints'],
  user_metadata: {
    base_model: 'sdxl',
    description: 'Stable Diffusion XL Base 1.0'
  },
  created_at: '2025-01-15T10:30:00Z',
  updated_at: '2025-01-15T10:30:00Z'
})

export const STABLE_CHECKPOINT_2: Asset = createModelAsset({
  id: 'test-checkpoint-002',
  name: 'v1-5-pruned-emaonly.safetensors',
  size: 4_265_146_304,
  tags: ['models', 'checkpoints'],
  user_metadata: {
    base_model: 'sd15',
    description: 'Stable Diffusion 1.5 Pruned EMA-Only'
  },
  created_at: '2025-01-20T08:00:00Z',
  updated_at: '2025-01-20T08:00:00Z'
})

export const STABLE_LORA: Asset = createModelAsset({
  id: 'test-lora-001',
  name: 'detail_enhancer_v1.2.safetensors',
  size: 184_549_376,
  tags: ['models', 'loras'],
  user_metadata: {
    base_model: 'sdxl',
    description: 'Detail Enhancement LoRA'
  },
  created_at: '2025-02-20T14:00:00Z',
  updated_at: '2025-02-20T14:00:00Z'
})

export const STABLE_LORA_2: Asset = createModelAsset({
  id: 'test-lora-002',
  name: 'add_detail_v2.safetensors',
  size: 226_492_416,
  tags: ['models', 'loras'],
  user_metadata: {
    base_model: 'sd15',
    description: 'Add Detail LoRA v2'
  },
  created_at: '2025-02-25T11:00:00Z',
  updated_at: '2025-02-25T11:00:00Z'
})

export const STABLE_VAE: Asset = createModelAsset({
  id: 'test-vae-001',
  name: 'sdxl_vae.safetensors',
  size: 334_641_152,
  tags: ['models', 'vae'],
  user_metadata: {
    base_model: 'sdxl',
    description: 'SDXL VAE'
  },
  created_at: '2025-01-18T16:00:00Z',
  updated_at: '2025-01-18T16:00:00Z'
})

export const STABLE_EMBEDDING: Asset = createModelAsset({
  id: 'test-embedding-001',
  name: 'bad_prompt_v2.pt',
  size: 32_768,
  mime_type: 'application/x-pytorch',
  tags: ['models', 'embeddings'],
  user_metadata: {
    base_model: 'sd15',
    description: 'Negative Embedding: Bad Prompt v2'
  },
  created_at: '2025-02-01T09:30:00Z',
  updated_at: '2025-02-01T09:30:00Z'
})

export const STABLE_INPUT_IMAGE: Asset = createInputAsset({
  id: 'test-input-001',
  name: 'reference_photo.png',
  size: 2_048_576,
  mime_type: 'image/png',
  tags: ['input'],
  created_at: '2025-03-01T09:00:00Z',
  updated_at: '2025-03-01T09:00:00Z'
})

export const STABLE_INPUT_IMAGE_2: Asset = createInputAsset({
  id: 'test-input-002',
  name: 'mask_layer.png',
  size: 1_048_576,
  mime_type: 'image/png',
  tags: ['input'],
  created_at: '2025-03-05T10:00:00Z',
  updated_at: '2025-03-05T10:00:00Z'
})

export const STABLE_INPUT_VIDEO: Asset = createInputAsset({
  id: 'test-input-003',
  name: 'clip_720p.mp4',
  size: 15_728_640,
  mime_type: 'video/mp4',
  tags: ['input'],
  created_at: '2025-03-08T14:30:00Z',
  updated_at: '2025-03-08T14:30:00Z'
})

export const STABLE_OUTPUT: Asset = createOutputAsset({
  id: 'test-output-001',
  name: 'ComfyUI_00001_.png',
  size: 4_194_304,
  mime_type: 'image/png',
  tags: ['output'],
  created_at: '2025-03-10T12:00:00Z',
  updated_at: '2025-03-10T12:00:00Z'
})

export const STABLE_OUTPUT_2: Asset = createOutputAsset({
  id: 'test-output-002',
  name: 'ComfyUI_00002_.png',
  size: 3_670_016,
  mime_type: 'image/png',
  tags: ['output'],
  created_at: '2025-03-10T12:05:00Z',
  updated_at: '2025-03-10T12:05:00Z'
})
export const ALL_MODEL_FIXTURES: Asset[] = [
  STABLE_CHECKPOINT,
  STABLE_CHECKPOINT_2,
  STABLE_LORA,
  STABLE_LORA_2,
  STABLE_VAE,
  STABLE_EMBEDDING
]

export const ALL_INPUT_FIXTURES: Asset[] = [
  STABLE_INPUT_IMAGE,
  STABLE_INPUT_IMAGE_2,
  STABLE_INPUT_VIDEO
]

export const ALL_OUTPUT_FIXTURES: Asset[] = [STABLE_OUTPUT, STABLE_OUTPUT_2]
const CHECKPOINT_NAMES = [
  'sd_xl_base_1.0.safetensors',
  'v1-5-pruned-emaonly.safetensors',
  'sd_xl_refiner_1.0.safetensors',
  'dreamshaper_8.safetensors',
  'realisticVision_v51.safetensors',
  'deliberate_v3.safetensors',
  'anything_v5.safetensors',
  'counterfeit_v3.safetensors',
  'revAnimated_v122.safetensors',
  'majicmixRealistic_v7.safetensors'
]

const LORA_NAMES = [
  'detail_enhancer_v1.2.safetensors',
  'add_detail_v2.safetensors',
  'epi_noiseoffset_v2.safetensors',
  'lcm_lora_sdxl.safetensors',
  'film_grain_v1.safetensors',
  'sharpness_fix_v2.safetensors',
  'better_hands_v1.safetensors',
  'smooth_skin_v3.safetensors',
  'color_pop_v1.safetensors',
  'bokeh_effect_v2.safetensors'
]

const INPUT_NAMES = [
  'reference_photo.png',
  'mask_layer.png',
  'clip_720p.mp4',
  'depth_map.png',
  'control_pose.png',
  'sketch_input.jpg',
  'inpainting_mask.png',
  'style_reference.png',
  'batch_001.png',
  'batch_002.png'
]

const EXTENSION_MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac'
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_MIME_MAP[ext] ?? 'application/octet-stream'
}

/**
 * Generate N deterministic model assets of a given category.
 * Uses sequential IDs and fixed names for screenshot stability.
 */
export function generateModels(
  count: number,
  category: 'checkpoints' | 'loras' | 'vae' | 'embeddings' = 'checkpoints'
): Asset[] {
  const names = category === 'loras' ? LORA_NAMES : CHECKPOINT_NAMES
  return Array.from({ length: Math.min(count, names.length) }, (_, i) =>
    createModelAsset({
      id: `gen-${category}-${String(i + 1).padStart(3, '0')}`,
      name: names[i % names.length],
      size: 2_000_000_000 + i * 500_000_000,
      tags: ['models', category],
      user_metadata: { base_model: i % 2 === 0 ? 'sdxl' : 'sd15' },
      created_at: `2025-01-${String(15 + i).padStart(2, '0')}T10:00:00Z`,
      updated_at: `2025-01-${String(15 + i).padStart(2, '0')}T10:00:00Z`
    })
  )
}

/**
 * Generate N deterministic input file assets.
 */
export function generateInputFiles(count: number): Asset[] {
  return Array.from({ length: Math.min(count, INPUT_NAMES.length) }, (_, i) => {
    const name = INPUT_NAMES[i % INPUT_NAMES.length]
    return createInputAsset({
      id: `gen-input-${String(i + 1).padStart(3, '0')}`,
      name,
      size: 1_000_000 + i * 500_000,
      mime_type: getMimeType(name),
      tags: ['input'],
      created_at: `2025-03-${String(1 + i).padStart(2, '0')}T09:00:00Z`,
      updated_at: `2025-03-${String(1 + i).padStart(2, '0')}T09:00:00Z`
    })
  })
}

/**
 * Generate N deterministic output assets.
 */
export function generateOutputAssets(count: number): Asset[] {
  return Array.from({ length: count }, (_, i) =>
    createOutputAsset({
      id: `gen-output-${String(i + 1).padStart(3, '0')}`,
      name: `ComfyUI_${String(i + 1).padStart(5, '0')}_.png`,
      size: 3_000_000 + i * 200_000,
      mime_type: 'image/png',
      tags: ['output'],
      created_at: `2025-03-10T${String((12 + Math.floor(i / 60)) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
      updated_at: `2025-03-10T${String((12 + Math.floor(i / 60)) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`
    })
  )
}

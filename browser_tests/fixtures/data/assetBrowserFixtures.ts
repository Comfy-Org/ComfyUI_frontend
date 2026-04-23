import type { Asset } from '@comfyorg/ingest-types'

function createAssetBrowserModel(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'browser-model-001',
    name: 'test_model.safetensors',
    asset_hash:
      'blake3:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
    size: 2_147_483_648,
    mime_type: 'application/octet-stream',
    tags: ['models', 'checkpoints'],
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    last_access_time: '2025-01-15T10:00:00Z',
    ...overrides
  }
}

export const EDITABLE_MODEL: Asset = createAssetBrowserModel({
  id: 'browser-model-editable-001',
  name: 'cinematic_details_v2.safetensors',
  tags: ['models', 'loras'],
  is_immutable: false,
  metadata: {
    description: 'A cinematic detail enhancer LoRA tuned for portraits.',
    source_arn: 'civitai:model:12345:version:67890',
    trained_words: ['cinematic lighting', 'sharp details', 'portrait glow'],
    filename: 'cinematic_details_v2.safetensors'
  },
  user_metadata: {
    name: 'Cinematic Details v2',
    base_model: ['sdxl', 'flux.1-dev'],
    additional_tags: ['portrait', 'detail'],
    user_description: 'Great for close-up portraits and high-frequency details.'
  }
})

export const IMMUTABLE_MODEL: Asset = createAssetBrowserModel({
  id: 'browser-model-immutable-001',
  name: 'sdxl_base_1.0.safetensors',
  tags: ['models', 'checkpoints'],
  is_immutable: true,
  metadata: {
    description: 'Official SDXL base checkpoint from Hugging Face.',
    repo_url: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0'
  },
  user_metadata: {}
})

export const BARE_MODEL: Asset = createAssetBrowserModel({
  id: 'browser-model-bare-001',
  name: 'bare_checkpoint.safetensors',
  tags: ['models', 'checkpoints'],
  is_immutable: false,
  metadata: {},
  user_metadata: {}
})

export const MOCK_MODEL_FOLDERS: Array<{ name: string; folders: string[] }> = [
  { name: 'checkpoints', folders: ['main'] },
  { name: 'loras', folders: ['style', 'detail'] },
  { name: 'vae', folders: ['default'] },
  { name: 'controlnet', folders: ['canny', 'depth'] }
]

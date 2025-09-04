import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Asset } from '@/types/assetTypes'

// Mock checkpoint data for testing
const MOCK_CHECKPOINT_ASSETS: Asset[] = [
  {
    id: '1',
    name: 'Realistic Vision V5.1',
    filename: 'realisticVisionV51_v51VAE.safetensors',
    file_type: 'safetensors',
    file_size: 2301870000,
    tags: ['models', 'checkpoints', 'realistic', 'photorealistic'],
    metadata: {
      description:
        'High-quality photorealistic model for general purpose image generation',
      author: 'SG_161222',
      model_type: 'Checkpoint',
      base_model: 'SD1.5'
    }
  },
  {
    id: '2',
    name: 'DreamShaper XL',
    filename: 'dreamshaperXL_v21TurboDPMSDE.safetensors',
    file_type: 'safetensors',
    file_size: 6460000000,
    tags: ['models', 'checkpoints', 'sdxl', 'artistic'],
    metadata: {
      description: 'Versatile SDXL model with excellent artistic capabilities',
      author: 'Lykon',
      model_type: 'Checkpoint',
      base_model: 'SDXL'
    }
  },
  {
    id: '3',
    name: 'Anime Model V3',
    filename: 'animeArtDiffusionXL_alpha3.safetensors',
    file_type: 'safetensors',
    file_size: 6460000000,
    tags: ['models', 'checkpoints', 'anime', 'stylized'],
    metadata: {
      description: 'Specialized model for anime and manga style artwork',
      author: 'Linaqruf',
      model_type: 'Checkpoint',
      base_model: 'SDXL'
    }
  },
  {
    id: '4',
    name: 'Photorealistic Base',
    filename: 'epicrealism_naturalSinRC1VAE.safetensors',
    file_type: 'safetensors',
    file_size: 2301870000,
    tags: ['models', 'checkpoints', 'realistic', 'photography'],
    metadata: {
      description: 'Professional photography style model with natural lighting',
      author: 'epinikion',
      model_type: 'Checkpoint',
      base_model: 'SD1.5'
    }
  },
  {
    id: '5',
    name: 'Fantasy Mix',
    filename: 'fantasyWorld_v10.safetensors',
    file_type: 'safetensors',
    file_size: 2301870000,
    tags: ['models', 'checkpoints', 'fantasy', 'creative'],
    metadata: {
      description: 'Fantasy and magical scenes with vibrant colors',
      author: 'RealCartoon3D',
      model_type: 'Checkpoint',
      base_model: 'SD1.5'
    }
  }
]

export const useAssetStore = defineStore('asset', () => {
  // State
  const assets = ref<Asset[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // Computed
  const isAssetApiAvailable = computed(() => {
    // For now, always return true for testing
    // In real implementation: api.serverSupportsFeature('asset_api')
    return true
  })

  // Actions
  async function loadCheckpointAssets(): Promise<Asset[]> {
    try {
      isLoading.value = true
      error.value = null

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      assets.value = [...MOCK_CHECKPOINT_ASSETS]
      console.log('✅ Loaded checkpoint assets:', assets.value.length)

      return assets.value
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      console.error('❌ Error loading checkpoint assets:', err)
      return []
    } finally {
      isLoading.value = false
    }
  }

  function searchAssets(query: string): Asset[] {
    if (!query) {
      return assets.value
    }

    const lowercaseQuery = query.toLowerCase()
    return assets.value.filter(
      (asset) =>
        asset.name.toLowerCase().includes(lowercaseQuery) ||
        asset.filename.toLowerCase().includes(lowercaseQuery) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)) ||
        asset.metadata?.description?.toLowerCase().includes(lowercaseQuery) ||
        asset.metadata?.author?.toLowerCase().includes(lowercaseQuery)
    )
  }

  return {
    // State
    assets: computed(() => assets.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),

    // Computed
    isAssetApiAvailable,

    // Actions
    loadCheckpointAssets,
    searchAssets
  }
})

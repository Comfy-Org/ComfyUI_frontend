<template>
  <BaseModalLayout
    :content-title="$t('modelBrowser.title')"
    @close="handleClose"
  >
    <template #content>
      <div class="flex-1 overflow-auto p-6">
        <div v-if="testModels.length === 0" class="text-center py-8">
          <p class="text-muted-foreground">
            {{ $t('modelBrowser.noModels') }}
          </p>
        </div>
        <div
          v-else
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          <ModelCard
            v-for="(model, index) in testModels"
            :key="model.id"
            :model="model"
            :focused="index === 0"
            @focus="handleModelFocus"
            @select="handleModelSelect"
            @show-info="handleShowInfo"
          />
        </div>
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import { ComfyModelDef } from '@/stores/modelStore'
import type { EnrichedModel } from '@/types/modelBrowserTypes'
import { transformToEnrichedModel } from '@/utils/modelBrowser/modelTransform'

import ModelCard from './ModelCard.vue'

const emit = defineEmits<{
  select: [model: ComfyModelDef]
  close: []
}>()

// TODO: Remove mock data once API integration is complete
// Create test models for visual verification
const mockCheckpoint1 = new ComfyModelDef(
  'dreamshaper_8.safetensors',
  'checkpoints',
  0
)
mockCheckpoint1.title = 'DreamShaper 8'

const mockCheckpoint2 = new ComfyModelDef(
  'realisticVision_v51.safetensors',
  'checkpoints',
  0
)
mockCheckpoint2.title = 'Realistic Vision v5.1'

const mockCheckpoint3 = new ComfyModelDef(
  'sdxl_base_1.0.safetensors',
  'checkpoints',
  0
)
mockCheckpoint3.title = 'Stable Diffusion XL Base'

const mockLora1 = new ComfyModelDef('detail_tweaker.safetensors', 'loras', 0)
mockLora1.title = 'Detail Tweaker LoRA'

const mockLora2 = new ComfyModelDef('add_more_details.safetensors', 'loras', 0)
mockLora2.title = 'Add More Details'

const mockVae = new ComfyModelDef('vae-ft-mse-840000.safetensors', 'vae', 0)
mockVae.title = 'VAE FT MSE'

const mockControlNet = new ComfyModelDef(
  'control_v11p_sd15_canny.safetensors',
  'controlnet',
  0
)
mockControlNet.title = 'Canny ControlNet'

const mockEmbedding = new ComfyModelDef(
  'bad-hands-5.safetensors',
  'embeddings',
  0
)
mockEmbedding.title = 'Bad Hands Negative'

const testModels: EnrichedModel[] = [
  transformToEnrichedModel(mockCheckpoint1),
  transformToEnrichedModel(mockCheckpoint2),
  transformToEnrichedModel(mockCheckpoint3),
  transformToEnrichedModel(mockLora1),
  transformToEnrichedModel(mockLora2),
  transformToEnrichedModel(mockVae),
  transformToEnrichedModel(mockControlNet),
  transformToEnrichedModel(mockEmbedding)
]

testModels[0].size = 6938040682
testModels[1].size = 2132799954
testModels[2].size = 6616593350
testModels[3].size = 143259238
testModels[3].modified = 1704067200
testModels[4].size = 75482758
testModels[4].modified = 1701388800
testModels[5].size = 334695179
testModels[6].size = 1448464867
testModels[7].size = 25600

function handleClose() {
  emit('close')
}

function handleModelFocus(_model: EnrichedModel) {
  // Handle model focus for keyboard navigation
}

function handleModelSelect(model: EnrichedModel) {
  emit('select', model.original)
}

function handleShowInfo(_model: EnrichedModel) {
  // TODO: Implement model info panel
}
</script>

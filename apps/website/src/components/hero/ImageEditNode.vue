<script setup lang="ts">
import { Workflow } from '@lucide/vue'

import { ref } from 'vue'

import GraphNode from './GraphNode.vue'
import NodeComboRow from './NodeComboRow.vue'
import NodeImagePreview from './NodeImagePreview.vue'
import NodeToggleRow from './NodeToggleRow.vue'
import NodeWidgetRow from './NodeWidgetRow.vue'

const { result, running = false } = defineProps<{
  result: string | null
  running?: boolean
}>()

const collapsed = defineModel<boolean>('collapsed', { default: false })
const turbo = defineModel<boolean>('turbo', { default: true })

const seed = ref('762242556604240')

const models = ref({
  unet_name: 'Comfy-Org/Qwen-Image-Edit_2511_fp8.safetensors',
  clip_name: 'Comfy-Org/Qwen-Image_ComfyUI_fp8.safetensors',
  vae_name: 'Comfy-Org/Qwen-Image_ComfyUI_vae.safetensors',
  lightning_lora: 'lightx2v/Qwen-Image-Edit-2511-Lightning.safetensors',
  lora_name: 'fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA.safetensors'
})

function stepSeed(direction: 1 | -1) {
  const current = Number.parseInt(seed.value, 10)
  if (!Number.isNaN(current))
    seed.value = String(Math.max(0, current + direction))
}

function commitSeed(raw: string) {
  const digits = raw.replaceAll(/\D/g, '')
  if (digits) seed.value = digits
}

function shuffleSeed() {
  seed.value = String(Math.floor(Math.random() * 1e15))
}
</script>

<template>
  <GraphNode
    v-model:collapsed="collapsed"
    title="Image Edit (Qwen-Image 2511 with LoRA)"
    :ports="[
      {
        input: { label: 'image', type: 'IMAGE', connected: true },
        output: { label: 'IMAGE', type: 'IMAGE' }
      },
      { input: { label: 'image2', type: 'IMAGE' } },
      { input: { label: 'image3', type: 'IMAGE' } },
      { input: { label: 'prompt', type: 'STRING', muted: true } }
    ]"
  >
    <NodeToggleRow
      v-model="turbo"
      label="enable_turbo_mode"
      class="mt-[0.375em]"
    />
    <NodeComboRow
      v-for="(value, name) in models"
      :key="name"
      v-model="models[name]"
      :label="name"
      :options="[value]"
      label-width="w-[7em]"
    />
    <NodeWidgetRow
      label="seed"
      :value="seed"
      label-width="w-[7em]"
      shuffle
      @step="stepSeed"
      @commit="commitSeed"
      @shuffle="shuffleSeed"
    />
    <NodeImagePreview
      :src="result"
      :running
      alt="Generated preview of the scene from the selected camera angle"
      caption="512 × 277"
      :width="512"
      :height="277"
    />
    <template #footer>
      <span
        class="flex items-center justify-center gap-[0.4em] py-[0.5em] text-[0.75em] text-white/80"
      >
        Enter Subgraph
        <Workflow class="size-[0.875em] text-white/60" aria-hidden="true" />
      </span>
    </template>
  </GraphNode>
</template>

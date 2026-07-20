<script setup lang="ts">
import { ref } from 'vue'

import GraphNode from './GraphNode.vue'
import NodeImagePreview from './NodeImagePreview.vue'

const { result, running = false } = defineProps<{
  result: string | null
  running?: boolean
}>()

const collapsed = defineModel<boolean>('collapsed', { default: false })

const filenamePrefix = ref('Qwen_Edit_2511')
</script>

<template>
  <GraphNode
    v-model:collapsed="collapsed"
    title="Save Image"
    :ports="[{ input: { label: 'images', type: 'IMAGE', connected: true } }]"
  >
    <div class="flex h-[1.625em] items-center gap-[0.625em] text-[0.75em]">
      <span class="shrink-0 text-white/60">filename_prefix</span>
      <input
        v-model="filenamePrefix"
        aria-label="Filename prefix"
        class="h-full min-w-0 flex-1 rounded-[0.375em] bg-black/25 px-[0.625em] text-white/90 outline-none focus:bg-black/40"
      />
    </div>
    <NodeImagePreview
      :src="result"
      :running
      alt="Final rendered image of the scene from the selected camera angle"
      caption="1392 × 752"
      :width="1392"
      :height="752"
      priority
    />
  </GraphNode>
</template>

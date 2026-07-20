<script setup lang="ts">
import { FolderOpen } from '@lucide/vue'

import { ref } from 'vue'

import GraphNode from './GraphNode.vue'
import NodeComboRow from './NodeComboRow.vue'
import NodeImagePreview from './NodeImagePreview.vue'

const collapsed = defineModel<boolean>('collapsed', { default: false })

const imageName = ref('cyber_genesis.png')
</script>

<template>
  <GraphNode
    v-model:collapsed="collapsed"
    title="Load Image"
    tinted
    :ports="[
      { output: { label: 'IMAGE', type: 'IMAGE' } },
      { output: { label: 'MASK', type: 'MASK' } }
    ]"
  >
    <NodeComboRow
      v-model="imageName"
      label="image"
      :options="['cyber_genesis.png']"
    >
      <template #trailing>
        <span
          class="flex h-full w-[1.75em] shrink-0 items-center justify-center rounded-[0.375em] bg-black/25"
        >
          <FolderOpen class="size-[0.875em] text-white/60" aria-hidden="true" />
        </span>
      </template>
    </NodeComboRow>
    <NodeImagePreview
      src="/hero/input.webp"
      alt="Input image: two robotic hands reaching toward each other through glowing rings"
      caption="1408 × 768"
      :width="1408"
      :height="768"
    />
  </GraphNode>
</template>

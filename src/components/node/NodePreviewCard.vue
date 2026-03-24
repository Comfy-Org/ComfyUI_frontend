<template>
  <div
    class="flex flex-col overflow-hidden rounded-lg border border-border-default bg-base-background"
    :style="{ width: `${BASE_WIDTH_PX * (scaleFactor / BASE_SCALE)}px` }"
  >
    <div ref="previewContainerRef" class="overflow-hidden p-3">
      <div
        ref="previewWrapperRef"
        class="origin-top-left"
        :style="{ transform: `scale(${scaleFactor})` }"
      >
        <LGraphNodePreview :node-def="nodeDef" position="relative" />
      </div>
    </div>

    <!-- Content Section -->
    <div class="flex flex-col gap-2 p-3 pt-1">
      <!-- Title -->
      <h3 class="text-foreground m-0 text-xs font-semibold">
        {{ nodeDef.display_name }}
      </h3>

      <!-- Category Path -->
      <p
        v-if="showCategoryPath && nodeDef.category"
        class="-mt-1 truncate text-xs text-muted-foreground"
      >
        {{ categoryPath }}
      </p>

      <!-- Badges -->
      <div class="flex flex-wrap gap-2 overflow-hidden empty:hidden">
        <NodePricingBadge class="max-w-full truncate" :node-def="nodeDef" />
        <NodeProviderBadge :node-def="nodeDef" />
      </div>

      <!-- Description -->
      <p
        v-if="nodeDef.description"
        class="m-0 max-h-[30vh] overflow-y-auto text-xs/normal font-normal text-muted-foreground"
      >
        {{ nodeDef.description }}
      </p>

      <!-- Divider -->
      <div
        v-if="(inputs.length > 0 || outputs.length > 0) && showInputsAndOutputs"
        class="border-t border-border-default"
      />

      <!-- Inputs Section -->
      <div
        v-if="inputs.length > 0 && showInputsAndOutputs"
        class="flex flex-col gap-1"
      >
        <h4
          class="m-0 text-xxs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {{ $t('nodeHelpPage.inputs') }}
        </h4>
        <div
          v-for="input in inputs"
          :key="input.name"
          class="flex items-center justify-between gap-2 text-xxs"
        >
          <span class="text-foreground shrink-0">{{ input.name }}</span>
          <span class="min-w-0 truncate text-muted-foreground">{{
            input.type
          }}</span>
        </div>
      </div>

      <!-- Outputs Section -->
      <div
        v-if="outputs.length > 0 && showInputsAndOutputs"
        class="flex flex-col gap-1"
      >
        <h4
          class="m-0 text-xxs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {{ $t('nodeHelpPage.outputs') }}
        </h4>
        <div
          v-for="output in outputs"
          :key="output.name"
          class="flex items-center justify-between gap-2 text-xxs"
        >
          <span class="text-foreground shrink-0">{{ output.name }}</span>
          <span class="min-w-0 truncate text-muted-foreground">{{
            output.type
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, ref } from 'vue'

import NodePricingBadge from '@/components/node/NodePricingBadge.vue'
import NodeProviderBadge from '@/components/node/NodeProviderBadge.vue'
import LGraphNodePreview from '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const BASE_WIDTH_PX = 200
const BASE_SCALE = 0.5
const PREVIEW_CONTAINER_PADDING_PX = 24

const {
  nodeDef,
  showInputsAndOutputs = true,
  showCategoryPath = false,
  scaleFactor = 0.5
} = defineProps<{
  nodeDef: ComfyNodeDefImpl
  showInputsAndOutputs?: boolean
  showCategoryPath?: boolean
  scaleFactor?: number
}>()

const previewContainerRef = ref<HTMLElement>()
const previewWrapperRef = ref<HTMLElement>()

useResizeObserver(previewWrapperRef, (entries) => {
  const entry = entries[0]
  if (entry && previewContainerRef.value) {
    const scaledHeight = entry.contentRect.height * scaleFactor
    previewContainerRef.value.style.height = `${scaledHeight + PREVIEW_CONTAINER_PADDING_PX}px`
  }
})

const categoryPath = computed(() => nodeDef.category?.replaceAll('/', ' / '))

const inputs = computed(() => {
  if (!nodeDef.inputs) return []
  return Object.entries(nodeDef.inputs)
    .filter(([_, input]) => !input.hidden)
    .map(([name, input]) => ({
      name,
      type: input.type
    }))
})

const outputs = computed(() => {
  if (!nodeDef.outputs) return []
  return nodeDef.outputs.map((output) => ({
    name: output.name,
    type: output.type
  }))
})
</script>

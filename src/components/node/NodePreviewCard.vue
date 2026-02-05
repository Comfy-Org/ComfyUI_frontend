<template>
  <div class="flex w-44 flex-col overflow-hidden rounded-2xl bg-[#1a1a1a]">
    <!-- Node Preview: LGraphNodePreview is 350px wide, scale to fit 144px (w-44 - p-4*2) -->
    <div ref="previewContainerRef" class="overflow-hidden p-4">
      <div ref="previewWrapperRef" class="origin-top-left scale-[0.41]">
        <LGraphNodePreview :node-def="nodeDef" position="relative" />
      </div>
    </div>

    <!-- Content Section -->
    <div class="flex flex-col gap-2 p-3 pt-1">
      <!-- Title -->
      <h3 class="text-sm font-bold text-white">
        {{ nodeDef.display_name }}
      </h3>

      <!-- Badges -->
      <div class="flex flex-wrap gap-1">
        <BadgePill
          v-if="nodeDef.nodeSource"
          :text="nodeDef.nodeSource.badgeText"
          icon="icon-[lucide--settings]"
          icon-class="text-amber-400"
        />
        <BadgePill
          v-if="nodeDef.nodeSource?.displayText"
          :text="nodeDef.nodeSource.displayText"
          icon="icon-[lucide--bar-chart-2]"
        />
      </div>

      <!-- Description -->
      <p
        v-if="nodeDef.description"
        class="line-clamp-2 text-xs leading-relaxed text-neutral-400"
      >
        {{ nodeDef.description }}
      </p>

      <!-- Divider -->
      <div class="border-t border-neutral-700" />

      <!-- Inputs Section -->
      <div v-if="inputs.length > 0" class="flex flex-col gap-1">
        <h4
          class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
        >
          {{ $t('nodeHelpPage.inputs') }}
        </h4>
        <div
          v-for="input in inputs"
          :key="input.name"
          class="flex items-center justify-between text-xs"
        >
          <span class="text-white">{{ input.name }}</span>
          <span class="text-neutral-500">{{ input.type }}</span>
        </div>
      </div>

      <!-- Outputs Section -->
      <div v-if="outputs.length > 0" class="flex flex-col gap-1">
        <h4
          class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
        >
          {{ $t('nodeHelpPage.outputs') }}
        </h4>
        <div
          v-for="output in outputs"
          :key="output.name"
          class="flex items-center justify-between text-xs"
        >
          <span class="text-white">{{ output.name }}</span>
          <span class="text-neutral-500">{{ output.type }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, ref } from 'vue'

import BadgePill from '@/components/common/BadgePill.vue'
import LGraphNodePreview from '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const SCALE_FACTOR = 0.41

const { nodeDef } = defineProps<{
  nodeDef: ComfyNodeDefImpl
}>()

const previewContainerRef = ref<HTMLElement>()
const previewWrapperRef = ref<HTMLElement>()

useResizeObserver(previewWrapperRef, (entries) => {
  const entry = entries[0]
  if (entry && previewContainerRef.value) {
    const scaledHeight = entry.contentRect.height * SCALE_FACTOR
    previewContainerRef.value.style.height = `${scaledHeight + 32}px`
  }
})

const inputs = computed(() => {
  if (!nodeDef.inputs) return []
  return Object.entries(nodeDef.inputs)
    .filter(([_, input]) => !(input as { hidden?: boolean }).hidden)
    .map(([name, input]) => ({
      name,
      type: (input as { type: string }).type
    }))
})

const outputs = computed(() => {
  if (!nodeDef.outputs) return []
  return nodeDef.outputs.map((output: { name: string; type?: string }) => ({
    name: output.name,
    type: output.type ?? output.name
  }))
})
</script>

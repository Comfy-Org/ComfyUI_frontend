<template>
  <div
    class="flex w-44 flex-col overflow-hidden rounded-2xl bg-(--base-background)"
  >
    <!-- Node Preview: LGraphNodePreview is 350px wide, scale to fit 144px (w-44 - p-4*2) -->
    <div ref="previewContainerRef" class="overflow-hidden p-4">
      <div ref="previewWrapperRef" class="origin-top-left scale-[0.41]">
        <LGraphNodePreview :node-def="nodeDef" position="relative" />
      </div>
    </div>

    <!-- Content Section -->
    <div class="flex flex-col gap-2 p-3 pt-1">
      <!-- Title -->
      <h3 class="text-xs font-bold text-foreground m-0">
        {{ nodeDef.display_name }}
      </h3>

      <!-- Badges -->
      <div class="flex flex-wrap gap-2">
        <BadgePill
          v-show="nodeDef.api_node && creditsLabel"
          :text="creditsLabel"
          icon="icon-[comfy--credits]"
          border-style="#f59e0b"
          filled
        />
        <BadgePill
          v-show="nodeDef.api_node && categoryLabel"
          :text="categoryLabel"
          :icon="getProviderIcon(categoryLabel ?? '')"
          :border-style="getProviderBorderStyle(categoryLabel ?? '')"
        />
      </div>

      <!-- Description -->
      <p
        v-if="nodeDef.description"
        class="line-clamp-2 text-xxs leading-relaxed text-muted-foreground m-0"
      >
        {{ nodeDef.description }}
      </p>

      <!-- Divider -->
      <div class="border-t border-border-default" />

      <!-- Inputs Section -->
      <div v-if="inputs.length > 0" class="flex flex-col gap-1">
        <h4
          class="text-xxs font-semibold uppercase tracking-wide text-muted-foreground m-0"
        >
          {{ $t('nodeHelpPage.inputs') }}
        </h4>
        <div
          v-for="input in inputs"
          :key="input.name"
          class="flex items-center justify-between text-xxs"
        >
          <span class="text-foreground">{{ input.name }}</span>
          <span class="text-muted-foreground">{{ input.type }}</span>
        </div>
      </div>

      <!-- Outputs Section -->
      <div v-if="outputs.length > 0" class="flex flex-col gap-1">
        <h4
          class="text-xxs font-semibold uppercase tracking-wide text-muted-foreground m-0"
        >
          {{ $t('nodeHelpPage.outputs') }}
        </h4>
        <div
          v-for="output in outputs"
          :key="output.name"
          class="flex items-center justify-between text-xxs"
        >
          <span class="text-foreground">{{ output.name }}</span>
          <span class="text-muted-foreground">{{ output.type }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'

import { evaluateNodeDefPricing } from '@/composables/node/useNodePricing'
import BadgePill from '@/components/common/BadgePill.vue'
import { getProviderBorderStyle, getProviderIcon } from '@/utils/categoryUtil'
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

const categoryLabel = computed(() => {
  if (!nodeDef.category) return ''
  return nodeDef.category.split('/').at(-1) ?? ''
})

const creditsLabel = ref('')

onMounted(async () => {
  if (nodeDef.api_node) {
    try {
      creditsLabel.value = await evaluateNodeDefPricing(nodeDef)
    } catch {
      creditsLabel.value = ''
    }
  }
})

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

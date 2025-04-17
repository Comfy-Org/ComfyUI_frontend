<template>
  <div class="relative w-24 h-24">
    <div
      v-for="(pack, index) in nodePacks.slice(0, maxVisible)"
      :key="pack.id"
      class="absolute"
      :style="{
        bottom: `${index * offset}px`,
        right: `${index * offset}px`,
        zIndex: maxVisible - index
      }"
    >
      <div class="border rounded-lg p-0.5">
        <PackIcon :node-pack="pack" width="4.5rem" height="4.5rem" />
      </div>
    </div>
    <div
      v-if="nodePacks.length > maxVisible"
      class="absolute -top-2 -right-2 bg-primary rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow-md z-10"
    >
      +{{ nodePacks.length - maxVisible }}
    </div>
  </div>
</template>

<script setup lang="ts">
import PackIcon from '@/components/dialog/content/manager/packIcon/PackIcon.vue'
import { components } from '@/types/comfyRegistryTypes'

const {
  nodePacks,
  maxVisible = 3,
  offset = 8
} = defineProps<{
  nodePacks: components['schemas']['Node'][]
  maxVisible?: number
  offset?: number
}>()
</script>

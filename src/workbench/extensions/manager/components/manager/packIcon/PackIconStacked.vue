<template>
  <div class="relative h-[104px] w-[224px] shadow-xl">
    <div
      v-for="(pack, index) in nodePacks.slice(0, maxVisible)"
      :key="pack.id"
      class="absolute h-[90px] w-[210px]"
      :style="{
        bottom: `${index * offset}px`,
        right: `${index * offset}px`,
        zIndex: maxVisible - index
      }"
    >
      <div class="rounded-lg border p-0.5 shadow-lg">
        <PackIcon :node-pack="pack" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { components } from '@/types/comfyRegistryTypes'
import PackIcon from '@/workbench/extensions/manager/components/manager/packIcon/PackIcon.vue'

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

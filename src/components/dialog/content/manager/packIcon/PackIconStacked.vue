<template>
  <div class="relative w-[224px] h-[104px] shadow-xl">
    <div
      v-for="(pack, index) in nodePacks.slice(0, maxVisible)"
      :key="pack.id"
      class="absolute w-[210px] h-[90px]"
      :style="{
        bottom: `${index * offset}px`,
        right: `${index * offset}px`,
        zIndex: maxVisible - index
      }"
    >
      <div class="border rounded-lg shadow-lg p-0.5">
        <PackIcon :node-pack="pack" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PackIcon from '@/components/dialog/content/manager/packIcon/PackIcon.vue'
import type { components } from '@/types/comfyRegistryTypes'

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

<template>
  <div class="grid grid-cols-2 gap-2">
    <template v-for="col in deviceColumns" :key="col.field">
      <div class="font-medium">{{ $t(col.header) }}:</div>
      <div>{{ props.device[col.field] }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DeviceStats } from '@/types/apiTypes'

const props = defineProps<{
  device: DeviceStats
}>()

const deviceColumns = [
  { field: 'name', header: 'name' },
  { field: 'type', header: 'type' },
  { field: 'index', header: 'index' },
  { field: 'vram_total', header: 'vramTotal' },
  { field: 'vram_free', header: 'vramFree' },
  { field: 'torch_vram_total', header: 'torchVramTotal' },
  { field: 'torch_vram_free', header: 'torchVramFree' }
]
</script>

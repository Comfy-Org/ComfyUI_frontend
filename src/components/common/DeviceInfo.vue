<template>
  <div class="grid grid-cols-2 gap-2">
    <template v-for="col in deviceColumns" :key="col.field">
      <div class="font-medium">{{ $t(col.header) }}</div>
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
  { field: 'name', header: 'Name' },
  { field: 'type', header: 'Type' },
  { field: 'vram_total', header: 'VRAM Total' },
  { field: 'vram_free', header: 'VRAM Free' },
  { field: 'torch_vram_total', header: 'Torch VRAM Total' },
  { field: 'torch_vram_free', header: 'Torch VRAM Free' }
]
</script>

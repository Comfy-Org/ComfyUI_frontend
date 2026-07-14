<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <MediaAssetFilterChip
      v-for="chip in chips"
      :key="chip.key"
      :label="chip.label"
      @remove="emit('remove', chip.key)"
    />
    <Button
      variant="textonly"
      class="h-6 px-1.5 text-xs text-muted-foreground"
      @click="emit('clear')"
    >
      {{ $t('sideToolbar.mediaAssets.clearFilters') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

import MediaAssetFilterChip from './MediaAssetFilterChip.vue'

export interface FilterChipDescriptor {
  key: string
  label: string
}

defineProps<{ chips: FilterChipDescriptor[] }>()

const emit = defineEmits<{
  remove: [key: string]
  clear: []
}>()
</script>

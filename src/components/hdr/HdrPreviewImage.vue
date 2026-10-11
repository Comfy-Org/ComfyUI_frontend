<template>
  <div>
    <img
      v-if="previewUrl"
      :src="previewUrl"
      :alt="filename"
      draggable="false"
      class="pointer-events-none size-full object-contain"
    />
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useGeneratedPreviewLookup } from '@/platform/assets/composables/useGeneratedPreviewLookup'

const { filename, assetId } = defineProps<{
  filename: string | undefined
  assetId?: string
}>()

const findGeneratedPreviewUrl = useGeneratedPreviewLookup()
const previewUrl = computed(() => findGeneratedPreviewUrl(filename, assetId))
</script>

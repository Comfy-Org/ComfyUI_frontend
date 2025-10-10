<template>
  <div class="flex flex-col">
    <!-- Duration and Format Chips -->
    <div
      v-if="showDurationChips"
      class="absolute bottom-2 left-2 flex gap-1"
      :class="durationChipClasses"
    >
      <SquareChip
        v-if="formattedDuration"
        variant="light"
        :label="formattedDuration"
      />
      <SquareChip v-if="fileFormat" variant="light" :label="fileFormat" />
    </div>

    <!-- Output Count Badge -->
    <div
      v-if="context?.outputCount"
      class="absolute right-2 bottom-2"
      :class="durationChipClasses"
    >
      <IconTextButton
        :label="context.outputCount.toString()"
        @click="handleOutputCountClick"
      >
        <template #icon>
          <i class="icon-[lucide--layers] size-4" />
        </template>
      </IconTextButton>
    </div>

    <!-- Zoom Button -->
    <div v-if="showZoomButton" class="absolute top-2 right-2">
      <IconButton size="sm" @click="handleZoom">
        <i class="icon-[lucide--zoom-in] size-4" />
      </IconButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import IconTextButton from '@/components/button/IconTextButton.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import { formatDuration } from '@/utils/formatUtil'

import { mediaAssetKey } from './mediaAssetProvider'

const { asset, context, isVideoPlaying, actions } = inject(mediaAssetKey)!

const showDurationChips = computed(() => {
  return asset.value?.duration !== undefined
})

const showZoomButton = computed(() => {
  return asset.value?.kind === 'image' || asset.value?.kind === '3D'
})

const formattedDuration = computed(() => {
  if (!asset.value?.duration) return ''
  return formatDuration(asset.value.duration)
})

const fileFormat = computed(() => {
  if (!asset.value?.name) return ''
  const parts = asset.value.name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : ''
})

const durationChipClasses = computed(() => {
  if (asset.value?.kind === 'audio') {
    return '-translate-y-11'
  }
  if (asset.value?.kind === 'video' && isVideoPlaying.value) {
    return '-translate-y-16'
  }
  return ''
})

const handleZoom = () => {
  if (asset.value) {
    actions.onView(asset.value.id)
  }
}

const handleOutputCountClick = () => {
  if (asset.value) {
    actions.onOutputCountClick(asset.value.id)
  }
}
</script>

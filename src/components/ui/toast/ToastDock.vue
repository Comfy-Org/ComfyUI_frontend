<script setup lang="ts">
import { provide } from 'vue'

import { overlayZIndexKey } from '@/composables/useModalLiftedZIndex'

const zIndex = 9999
provide(overlayZIndexKey, zIndex)
</script>

<template>
  <div
    data-toast-dock
    :style="{ zIndex }"
    class="pointer-events-none fixed inset-x-4 bottom-6 flex max-h-[calc(100dvh-3rem)] flex-col items-center gap-2 overflow-y-auto *:pointer-events-auto *:shrink-0 sm:inset-x-0"
  >
    <slot />
  </div>
</template>

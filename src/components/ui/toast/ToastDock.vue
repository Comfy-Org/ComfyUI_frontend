<script setup lang="ts">
import { provide } from 'vue'

import { TOAST_Z_INDEX } from '@/components/dialog/vRekaZIndex'
import { overlayZIndexKey } from '@/composables/useModalLiftedZIndex'

provide(overlayZIndexKey, TOAST_Z_INDEX)
</script>

<template>
  <div
    data-toast-dock
    :style="{ zIndex: TOAST_Z_INDEX }"
    class="pointer-events-none fixed inset-x-4 bottom-6 flex max-h-[calc(100dvh-3rem)] flex-col items-center gap-2 overflow-y-auto *:pointer-events-auto *:shrink-0 sm:inset-x-0"
  >
    <slot />
  </div>
</template>

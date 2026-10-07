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
    class="pointer-events-none fixed inset-x-4 bottom-6 flex flex-col items-center gap-2 *:pointer-events-auto sm:inset-x-0"
  >
    <slot />
  </div>
</template>

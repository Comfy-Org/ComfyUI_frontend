<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="pointer-events-none fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-base-foreground px-4 py-2 text-sm text-base-background shadow-lg"
    >
      {{ message }}
      <span
        v-if="shortcut"
        class="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-base-background/20 px-1 py-0 text-xs"
      >
        {{ shortcut }}
      </span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useCanvasToast } from '@/composables/useCanvasToast'

const { message, shortcut, visible } = useCanvasToast()
</script>

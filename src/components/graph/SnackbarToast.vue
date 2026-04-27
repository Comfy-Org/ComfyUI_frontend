<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed bottom-16 left-1/2 z-1000 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-base-foreground py-1 pr-2 pl-3 text-sm text-base-background shadow-lg"
      @mouseenter="pause"
      @mouseleave="startTimer"
    >
      {{ message }}
      <span v-if="hint" class="text-xs text-base-background/60">
        {{ hint }}
      </span>
      <div class="ml-4 flex items-center">
        <span
          v-if="shortcut"
          class="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-base-background/20 px-1 py-0 text-xs"
        >
          {{ shortcut }}
        </span>
        <Button
          v-if="hasAction"
          variant="link"
          size="md"
          class="text-sm text-base-background hover:text-base-background/70"
          @click="handleAction"
        >
          {{ actionLabel }}
        </Button>
        <Button
          variant="link"
          size="md"
          class="text-base-background hover:text-base-background/70"
          @click="dismiss"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useSnackbarToast } from '@/composables/useSnackbarToast'

const {
  message,
  shortcut,
  hint,
  visible,
  actionLabel,
  onAction,
  dismiss,
  pause,
  startTimer
} = useSnackbarToast()

const hasAction = computed(
  () => !!onAction.value && !shortcut.value && !hint.value
)

function handleAction() {
  onAction.value?.()
}
</script>

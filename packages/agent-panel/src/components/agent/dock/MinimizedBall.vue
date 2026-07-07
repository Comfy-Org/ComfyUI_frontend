<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDraggableBall } from '../../../composables/agent/useDraggableBall'
import { cn } from '../../../utils/cn'

const emit = defineEmits<{ open: [] }>()

const { t } = useI18n()

const ball = ref<HTMLElement | null>(null)
const { style, isDragging } = useDraggableBall(ball, {
  onTap: () => emit('open')
})

// Pointer taps open via useDraggableBall.onTap; a keyboard activation (Enter/Space) fires a
// synthetic click with detail === 0 that the drag machinery does not see, so open it here.
function onKeyActivate(event: MouseEvent): void {
  if (event.detail === 0) emit('open')
}
</script>

<template>
  <button
    ref="ball"
    type="button"
    :style="style"
    :aria-label="t('agent.title')"
    :class="
      cn(
        'bg-agent-accent text-agent-accent-fg fixed z-50 flex size-14 touch-none items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105',
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      )
    "
    @click="onKeyActivate"
  >
    <span class="icon-[lucide--sparkles] size-6" />
  </button>
</template>

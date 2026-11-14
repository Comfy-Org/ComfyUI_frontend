<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { CompassCorners } from '@comfyorg/shared-frontend-utils/geometry'
import { cn } from '@comfyorg/tailwind-utils'
import type { ResizeHandle } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'

const { handle } = defineProps<{ handle: ResizeHandle }>()
const emit = defineEmits<{
  resize: [event: PointerEvent, corner: CompassCorners]
}>()
const { t } = useI18n()
</script>

<template>
  <div
    role="button"
    :data-corner="handle.corner"
    :aria-label="t(handle.i18nKey)"
    :class="
      cn(
        'pointer-events-auto absolute size-5 touch-none opacity-0 group-hover/node:opacity-100 focus-visible:outline-2 focus-visible:outline-white/40',
        handle.positionClasses,
        handle.cursorClass
      )
    "
    @pointerdown.stop="emit('resize', $event, handle.corner)"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 12 12"
      :class="cn('absolute size-2/5', handle.svgPositionClasses)"
      :style="
        handle.svgTransform ? { transform: handle.svgTransform } : undefined
      "
    >
      <path
        d="M11 1L1 11M11 6L6 11"
        stroke="var(--color-muted-foreground)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { CompassCorners } from '@comfyorg/shared-frontend-utils/geometry'
import { cn } from '@comfyorg/tailwind-utils'
import type { ResizeHandle } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'

const { handle } = defineProps<{ handle: ResizeHandle }>()
const emit = defineEmits<{
  resize: [event: PointerEvent, corner: CompassCorners]
  fit: [event: MouseEvent]
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
        'pointer-events-auto absolute z-30 size-5 touch-none opacity-0 group-hover/node:opacity-100 focus-visible:outline-2 focus-visible:outline-white/40',
        handle.positionClasses,
        handle.cursorClass
      )
    "
    @pointerdown.stop="emit('resize', $event, handle.corner)"
    @dblclick.stop="emit('fit', $event)"
  >
    <i
      aria-hidden="true"
      :class="
        cn(
          'absolute icon-[comfy--resize-corner] size-2/5 text-muted-foreground',
          handle.svgPositionClasses
        )
      "
    />
  </div>
</template>

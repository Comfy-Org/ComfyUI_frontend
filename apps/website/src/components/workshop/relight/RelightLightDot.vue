<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Light } from '../../../lib/workshop/relight/lights'
import { lightHex } from '../../../lib/workshop/relight/lights'
import { nudgeFor } from '../../../lib/workshop/nudge'

const { light, label, selected } = defineProps<{
  light: Light
  label: string
  selected: boolean
}>()

const emit = defineEmits<{
  grab: [event: PointerEvent]
  nudge: [dx: number, dy: number]
}>()

function onKey(event: KeyboardEvent) {
  const step = nudgeFor(event)
  if (!step) return
  event.preventDefault()
  emit('nudge', step[0], step[1])
}
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :aria-pressed="selected"
    :class="
      cn(
        'absolute size-4 -translate-1/2 cursor-move touch-none rounded-full border-2 border-primary-warm-white shadow-md shadow-black/50 before:absolute before:-inset-2.5 before:content-[\'\'] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-comfy-yellow/70',
        selected &&
          'ring-3 ring-primary-comfy-yellow ring-offset-1 ring-offset-primary-comfy-ink',
        !light.visible && 'opacity-40'
      )
    "
    :style="{
      left: `${light.x * 100}%`,
      top: `${light.y * 100}%`,
      backgroundColor: lightHex(light.color)
    }"
    @pointerdown="emit('grab', $event)"
    @keydown="onKey"
  />
</template>

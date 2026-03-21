<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { direction, index, fractions } = defineProps<{
  direction: 'column' | 'row'
  index: number
  fractions: number[]
}>()

const emit = defineEmits<{
  resize: [fractions: number[]]
  resizeEnd: [fractions: number[]]
}>()

const dragging = ref(false)
let cleanupDrag: (() => void) | null = null

onBeforeUnmount(() => cleanupDrag?.())

function onPointerDown(e: PointerEvent) {
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  const parent = el.parentElement
  if (!parent) return

  el.setPointerCapture(e.pointerId)
  dragging.value = true

  const startPos = direction === 'column' ? e.clientX : e.clientY
  const totalSize =
    direction === 'column' ? parent.clientWidth : parent.clientHeight

  const startFractions = [...fractions]
  if (index < 0 || index >= startFractions.length - 1) return
  const totalFr = startFractions[index] + startFractions[index + 1]
  let latestFractions = startFractions

  function onPointerMove(ev: PointerEvent) {
    const currentPos = direction === 'column' ? ev.clientX : ev.clientY
    const deltaPx = currentPos - startPos
    const deltaFr =
      (deltaPx / totalSize) * startFractions.reduce((a, b) => a + b, 0)

    const MIN_FR = 0.25
    let newLeft = Math.max(MIN_FR, startFractions[index] + deltaFr)
    let newRight = totalFr - newLeft
    if (newRight < MIN_FR) {
      newRight = MIN_FR
      newLeft = totalFr - MIN_FR
    }

    const newFractions = [...startFractions]
    newFractions[index] = Math.round(newLeft * 100) / 100
    newFractions[index + 1] = Math.round(newRight * 100) / 100

    latestFractions = newFractions
    emit('resize', newFractions)
  }

  function onPointerUp() {
    dragging.value = false
    cleanupDrag?.()
    cleanupDrag = null
    emit('resizeEnd', latestFractions)
  }

  function onPointerCancel() {
    dragging.value = false
    cleanupDrag?.()
    cleanupDrag = null
  }

  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointercancel', onPointerCancel)
  cleanupDrag = () => {
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerCancel)
  }
}
</script>

<template>
  <div
    :class="
      cn(
        'absolute z-10 flex touch-none transition-opacity hover:opacity-100',
        dragging ? 'opacity-100' : 'opacity-30',
        direction === 'column'
          ? 'top-0 h-full w-4 -translate-x-1/2 cursor-col-resize justify-center'
          : 'left-0 h-6 w-full -translate-y-1/2 cursor-row-resize items-center'
      )
    "
    @pointerdown="onPointerDown"
  >
    <div
      :class="
        cn(
          'rounded-full bg-primary-background transition-colors',
          direction === 'column'
            ? 'mx-auto h-full w-0.5'
            : 'my-auto h-0.5 w-full'
        )
      "
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const hue = defineModel<number>('hue', { default: 0 })
const saturation = defineModel<number>('saturation', { default: 1 })

const ringEl = ref<HTMLElement>()

const KNOB_RADIUS = 40 // % of the ring box, on the colour band

const knobStyle = computed(() => {
  const rad = ((hue.value - 90) * Math.PI) / 180
  return {
    left: `${50 + Math.cos(rad) * KNOB_RADIUS}%`,
    top: `${50 + Math.sin(rad) * KNOB_RADIUS}%`
  }
})

const knobColor = computed(() => `hsl(${hue.value} 90% 55%)`)

function setFromPointer(clientX: number, clientY: number) {
  const el = ringEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90
  hue.value = ((Math.round(deg) % 360) + 360) % 360
}

function onPointerDown(event: PointerEvent) {
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  setFromPointer(event.clientX, event.clientY)
}

function onPointerMove(event: PointerEvent) {
  if (event.buttons === 0) return
  setFromPointer(event.clientX, event.clientY)
}

function onKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 15 : 5
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    hue.value = (hue.value - step + 360) % 360
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    hue.value = (hue.value + step) % 360
  } else {
    return
  }
  event.preventDefault()
}
</script>

<template>
  <div
    class="relative flex size-full flex-col rounded-[1.25em] border border-white/12 bg-[#242428]"
  >
    <div class="flex h-[2.25em] shrink-0 items-center px-[1.05em]">
      <span class="bg-primary-comfy-yellow size-[0.55em] rounded-full" />
      <span class="ml-auto flex items-center gap-[0.5em]">
        <span
          class="font-formula text-[0.7em] font-semibold tracking-[0.14em] text-white"
        >
          COLOR
        </span>
        <span class="bg-primary-comfy-yellow size-[0.55em] rounded-full" />
      </span>
    </div>

    <div
      class="flex min-h-0 flex-1 flex-col items-center gap-[0.6em] px-[0.9em] pb-[0.9em]"
    >
      <div
        ref="ringEl"
        role="slider"
        tabindex="0"
        aria-label="Hue"
        :aria-valuenow="hue"
        aria-valuemin="0"
        aria-valuemax="360"
        :aria-valuetext="`${hue} degrees`"
        class="relative aspect-square w-full max-w-[9em] cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        style="
          background: conic-gradient(
            hsl(0 90% 55%),
            hsl(60 90% 55%),
            hsl(120 90% 55%),
            hsl(180 90% 55%),
            hsl(240 90% 55%),
            hsl(300 90% 55%),
            hsl(360 90% 55%)
          );
        "
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @keydown="onKeydown"
      >
        <div
          class="absolute inset-[22%] flex items-center justify-center rounded-full bg-[#242428]"
        >
          <span
            class="font-formula text-[1.1em] font-semibold text-white/90 tabular-nums"
          >
            {{ hue }}°
          </span>
        </div>
        <span
          class="absolute size-[1.1em] -translate-1/2 rounded-full border-2 border-white shadow-sm"
          :style="{ ...knobStyle, backgroundColor: knobColor }"
        />
      </div>

      <label class="flex w-full items-center gap-[0.5em] text-[0.7em]">
        <span class="text-white/60">SAT</span>
        <input
          v-model.number="saturation"
          type="range"
          min="0"
          max="2"
          step="0.05"
          aria-label="Saturation"
          class="accent-primary-comfy-yellow h-[0.35em] flex-1 cursor-pointer"
        />
      </label>
    </div>
  </div>
</template>

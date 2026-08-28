<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useRafFn } from '@vueuse/core'
import { shallowRef } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

const COLS = 12
const ROWS = 6
const CELL_COUNT = COLS * ROWS

// Stage geometry as percentages of the card. The layout and the pulse maths
// read the same numbers so a travelling pulse lands on the columns it wakes.
const CLIENT_X = 6
const TRACK_START = 11.5
const TRACK_END = 95
// The dashed rule stops just short of where the pulse travels to.
const TRACK_RULE_END = 94
const TRACK_Y = 47
const GRID_LEFT = 22
const GRID_RIGHT = 95
const GRID_TOP = 9
const GRID_BOTTOM = 20

const FORWARD_MS = 3200
const RETURN_MS = 2500
const HOT_MS = 850
const ON_MIN_MS = 2700
const ON_JITTER_MS = 1200

// One request wakes the path, three more show traffic scaling, then the fleet
// drains to zero and rests before the cycle repeats.
const REQUESTS = [
  { start: 900, strength: 0.35 },
  { start: 7600, strength: 0.6 },
  { start: 8500, strength: 0.6 },
  { start: 9400, strength: 0.6 }
]
const DRAIN_AT = 16600
const CYCLE_MS = 19600

type CellState = 'rest' | 'on' | 'hot'

const cellStates = shallowRef<CellState[]>(
  Array.from({ length: CELL_COUNT }, () => 'rest')
)
const pulses = shallowRef<{ id: number; x: number }[]>([])

const onUntil = new Float64Array(CELL_COUNT)
const hotUntil = new Float64Array(CELL_COUNT)
const firedTo = REQUESTS.map(() => -1)
let cycle = 0
let clock = 0

const trackSpan = TRACK_END - TRACK_START
const columnWidth = (GRID_RIGHT - GRID_LEFT) / COLS

// Fraction of the track travelled when the pulse reaches a column's centre.
function columnArrival(col: number): number {
  return (GRID_LEFT + columnWidth * (col + 0.5) - TRACK_START) / trackSpan
}

function wake(col: number, strength: number, now: number) {
  const isGateway = col < 2
  const isDatabase = col >= COLS - 2
  if (!isGateway && !isDatabase && Math.random() >= strength) return

  const row = Math.floor(Math.random() * ROWS)
  const index = row * COLS + col
  onUntil[index] = now + ON_MIN_MS + Math.random() * ON_JITTER_MS
  if (col > 3 && col < 9) hotUntil[index] = now + HOT_MS
}

function resetCycle() {
  onUntil.fill(0)
  hotUntil.fill(0)
  firedTo.fill(-1)
}

function advance(delta: number) {
  clock += delta
  const position = clock % CYCLE_MS
  const currentCycle = Math.floor(clock / CYCLE_MS)
  if (currentCycle !== cycle) {
    cycle = currentCycle
    resetCycle()
  }
  if (position >= DRAIN_AT) {
    onUntil.fill(0)
    hotUntil.fill(0)
  }

  const active: { id: number; x: number }[] = []

  REQUESTS.forEach((request, id) => {
    const age = position - request.start
    if (age < 0 || age > FORWARD_MS + RETURN_MS) return

    const travelled =
      age <= FORWARD_MS ? age / FORWARD_MS : 1 - (age - FORWARD_MS) / RETURN_MS
    active.push({ id, x: TRACK_START + travelled * trackSpan })

    if (age > FORWARD_MS || position >= DRAIN_AT) return
    for (let col = firedTo[id] + 1; col < COLS; col++) {
      if (travelled < columnArrival(col)) break
      firedTo[id] = col
      wake(col, request.strength, position)
    }
  })

  pulses.value = active

  const next = Array.from(
    { length: CELL_COUNT },
    (_, i): CellState =>
      position < hotUntil[i] ? 'hot' : position < onUntil[i] ? 'on' : 'rest'
  )
  if (next.some((state, i) => state !== cellStates.value[i])) {
    cellStates.value = next
  }
}

useRafFn(({ delta }) => advance(Math.min(delta, 100)), {
  immediate: !prefersReducedMotion()
})

// The resting fleet is mottled rather than flat, so idle GPUs read as hardware
// rather than as an empty grid.
function restTone(index: number): string {
  const nth = index + 1
  if (nth % 11 === 0) return 'bg-[#6b5b91]'
  if (nth % 7 === 0) return 'bg-[#352c44]'
  if (nth % 3 === 0) return 'bg-[#4d4163]'
  return 'bg-[#403552]'
}
</script>

<template>
  <div
    aria-hidden="true"
    class="relative h-full min-h-72 overflow-hidden rounded-3xl border border-white/10 bg-[#241d2f]"
  >
    <div
      class="absolute -translate-y-1/2 text-center"
      :style="{ left: `${CLIENT_X}%`, top: `${TRACK_Y}%` }"
    >
      <div class="mx-auto mb-3.5 size-[22px] rounded-full bg-[#f0ec72]" />
      <div
        class="font-mono text-[11px] leading-[1.7] tracking-[0.08em] whitespace-nowrap text-[#e8e46a]"
      >
        CLIENT<br />REQUEST
      </div>
    </div>

    <div
      class="absolute border-t-2 border-dashed border-[#4a4157]"
      :style="{
        left: `${TRACK_START}%`,
        right: `${100 - TRACK_RULE_END}%`,
        top: `${TRACK_Y}%`
      }"
    />

    <div
      class="absolute grid gap-1.5"
      :style="{
        left: `${GRID_LEFT}%`,
        right: `${100 - GRID_RIGHT}%`,
        top: `${GRID_TOP}%`,
        bottom: `${GRID_BOTTOM}%`,
        gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`
      }"
    >
      <div
        v-for="(state, index) in cellStates"
        :key="index"
        :class="
          cn(
            'rounded-md transition-[background-color,box-shadow,filter] duration-350 ease-out',
            state === 'rest' && restTone(index),
            state === 'on' &&
              'bg-[#f0ec72] shadow-[0_0_14px_rgba(240,236,114,0.35)]',
            state === 'hot' &&
              'bg-[#fbf9b8] brightness-110 shadow-[0_0_26px_rgba(251,249,184,0.75)]'
          )
        "
      />
    </div>

    <div
      v-for="pulse in pulses"
      :key="pulse.id"
      class="absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fbf9b8] shadow-[0_0_12px_rgba(251,249,184,0.9)]"
      :style="{ left: `${pulse.x}%`, top: `${TRACK_Y}%` }"
    />

    <div
      class="absolute flex justify-between font-mono text-[11px] tracking-[0.08em] text-[#e8e46a]"
      :style="{
        left: `${GRID_LEFT}%`,
        right: `${100 - GRID_RIGHT}%`,
        bottom: `${GRID_TOP}%`
      }"
    >
      <span>API GATEWAY</span>
      <span>SERVERLESS FUNCTIONS</span>
      <span>DATABASE&nbsp;&nbsp;B200S</span>
    </div>
  </div>
</template>

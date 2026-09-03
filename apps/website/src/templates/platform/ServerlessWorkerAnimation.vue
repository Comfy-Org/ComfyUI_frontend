<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useElementVisibility, useRafFn } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const WORKER_COUNT = 3
const COLS_PER_WORKER = 4
const COLS = WORKER_COUNT * COLS_PER_WORKER
const ROWS = 5
const CELL_COUNT = COLS * ROWS
const LETTER_PIXEL_WIDTH = 3
const SEND_DURATION = 700
const WRITE_DURATION = 600
const HOLD_DURATION = 500
const JOB_DURATION = SEND_DURATION + WRITE_DURATION + HOLD_DURATION
const PACKET_TRAIL_OFFSETS = [0, 0.14, 0.28] as const
const LETTER_PATTERNS = [
  ['111', '100', '111', '001', '111'],
  ['111', '100', '110', '100', '111'],
  ['110', '101', '110', '101', '101'],
  ['101', '101', '101', '101', '010'],
  ['111', '100', '110', '100', '111'],
  ['110', '101', '110', '101', '101'],
  ['100', '100', '100', '100', '111'],
  ['111', '100', '110', '100', '111'],
  ['111', '100', '111', '001', '111'],
  ['111', '100', '111', '001', '111']
]
const CYCLE_DURATION = LETTER_PATTERNS.length * JOB_DURATION

type CellState = 'idle' | 'contribution' | 'hot'

interface ActivityCell {
  id: number
  localColumn: number
  row: number
  workerIndex: number
  opacity: number
}

interface DataPacket {
  id: number
  opacity: number
  progress: number
}

const stageRef = useTemplateRef<HTMLElement>('stageRef')
const onScreen = useElementVisibility(stageRef)
const elapsed = ref(0)
const reducedMotion = prefersReducedMotion()
const activityCells: ActivityCell[] = Array.from(
  { length: CELL_COUNT },
  (_, id) => {
    const column = id % COLS

    return {
      id,
      localColumn: column % COLS_PER_WORKER,
      row: Math.floor(id / COLS),
      workerIndex: Math.floor(column / COLS_PER_WORKER),
      opacity: ((id * 37 + 17) % 100) / 100
    }
  }
)
const workerIndexes = Array.from(
  { length: WORKER_COUNT },
  (_, workerIndex) => workerIndex
)

const frameTime = computed(() =>
  reducedMotion
    ? 2 * JOB_DURATION + SEND_DURATION + WRITE_DURATION
    : elapsed.value % CYCLE_DURATION
)
const jobIndex = computed(() => Math.floor(frameTime.value / JOB_DURATION))
const jobTime = computed(() => frameTime.value % JOB_DURATION)
const activeWorkerIndex = computed(() => jobIndex.value % WORKER_COUNT)
const isSending = computed(
  () => !reducedMotion && jobTime.value < SEND_DURATION
)
const packetHeadProgress = computed(() =>
  isSending.value ? jobTime.value / SEND_DURATION : 0
)
const dataPackets = computed<DataPacket[]>(() =>
  PACKET_TRAIL_OFFSETS.flatMap((offset, id) => {
    const progress = packetHeadProgress.value - offset

    if (!isSending.value || progress <= 0) return []

    const endpointFade = Math.min(1, progress / 0.08, (1 - progress) / 0.08)

    return [
      {
        id,
        progress,
        opacity: Math.max(0, endpointFade) * (1 - id * 0.24)
      }
    ]
  })
)

function workerFillProgress(cell: ActivityCell, currentJobTime: number) {
  const activeWorker = activeWorkerIndex.value

  if (cell.workerIndex < activeWorker) return 1
  if (cell.workerIndex > activeWorker || currentJobTime < SEND_DURATION) {
    return 0
  }
  if (currentJobTime >= SEND_DURATION + WRITE_DURATION) return 1

  return (currentJobTime - SEND_DURATION) / WRITE_DURATION
}

function cellState(cell: ActivityCell, currentJobTime: number): CellState {
  const chunkStart = Math.floor(jobIndex.value / WORKER_COUNT) * WORKER_COUNT
  const letterIndex = chunkStart + cell.workerIndex
  const pattern = LETTER_PATTERNS[letterIndex]

  if (!pattern || cell.localColumn >= LETTER_PIXEL_WIDTH) return 'idle'

  const fillProgress = workerFillProgress(cell, currentJobTime)
  if (fillProgress * LETTER_PIXEL_WIDTH <= cell.localColumn) return 'idle'

  return pattern[cell.row][cell.localColumn] === '1' ? 'hot' : 'contribution'
}

function isLeadingCell(cell: ActivityCell, currentJobTime: number) {
  if (
    cell.workerIndex !== activeWorkerIndex.value ||
    currentJobTime < SEND_DURATION ||
    currentJobTime >= SEND_DURATION + WRITE_DURATION
  ) {
    return false
  }

  const fillProgress = workerFillProgress(cell, currentJobTime)
  const leadingColumn = Math.min(
    LETTER_PIXEL_WIDTH - 1,
    Math.floor(fillProgress * LETTER_PIXEL_WIDTH)
  )

  return cell.localColumn === leadingColumn
}

const visualCells = computed(() =>
  activityCells.map((cell) => {
    const state = cellState(cell, jobTime.value)

    return {
      ...cell,
      state,
      isLeading: isLeadingCell(cell, jobTime.value),
      displayOpacity:
        state === 'idle'
          ? 0.18 + cell.opacity * 0.22
          : state === 'hot'
            ? 1
            : 0.42 + cell.opacity * 0.34
    }
  })
)

const { pause, resume } = useRafFn(
  ({ delta }) => {
    elapsed.value += delta
  },
  { immediate: false }
)

watch(
  onScreen,
  (visible) => {
    if (visible && !reducedMotion) resume()
    else pause()
  },
  { immediate: true }
)
</script>

<template>
  <div
    ref="stageRef"
    role="img"
    :aria-label="t('platform.serverlessVisual.ariaLabel', locale)"
    class="relative aspect-16/7 min-h-72 w-full overflow-hidden rounded-3xl bg-primary-comfy-ink font-mono"
  >
    <div
      class="absolute top-1/2 left-[max(9%,3.75rem)] z-10 size-12 -translate-1/2 sm:size-14"
      aria-hidden="true"
    >
      <img
        src="/assets/platform/serverless/local-node.svg"
        alt=""
        class="relative z-10 size-full"
      />
    </div>

    <div
      class="bg-primary-comfy-plum absolute top-1/2 left-[14%] h-px w-[16%] -translate-y-1/2"
      aria-hidden="true"
    >
      <span
        v-for="packet in dataPackets"
        :key="packet.id"
        class="bg-primary-comfy-yellow absolute top-1/2 size-2 -translate-1/2 rounded-full"
        :style="{
          left: `${packet.progress * 100}%`,
          opacity: packet.opacity
        }"
      />
    </div>

    <div
      class="absolute inset-y-[18%] right-[5%] left-3/10 grid grid-cols-12 grid-rows-5 gap-1.5 sm:gap-2"
      aria-hidden="true"
    >
      <span
        v-for="cell in visualCells"
        :key="cell.id"
        :class="
          cn(
            'bg-primary-comfy-yellow rounded-sm transition-[opacity,box-shadow] duration-150',
            (cell.state === 'hot' || cell.isLeading) &&
              'shadow-primary-comfy-yellow/35 shadow-md'
          )
        "
        :style="{ opacity: cell.displayOpacity }"
      />
    </div>

    <div
      class="text-primary-comfy-yellow/80 absolute right-[5%] bottom-[6%] left-3/10 grid grid-cols-3 text-[7px] tracking-widest uppercase sm:text-[9px] lg:text-[10px]"
    >
      <span
        v-for="workerIndex in workerIndexes"
        :key="workerIndex"
        :class="
          cn(
            workerIndex === 1 && 'text-center',
            workerIndex === 2 && 'text-right',
            workerIndex === activeWorkerIndex && 'text-primary-comfy-yellow'
          )
        "
      >
        {{ t('platform.serverlessVisual.worker', locale) }}
      </span>
    </div>
  </div>
</template>

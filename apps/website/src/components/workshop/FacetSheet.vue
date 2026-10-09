<script setup lang="ts">
import { X } from '@lucide/vue'
import { useMediaQuery, useWindowSize } from '@vueuse/core'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { SheetRest } from '@/composables/useBottomSheet'
import { heightAt, restAt } from '@/composables/useBottomSheet'
import { prefersReducedMotion } from '@/composables/useReducedMotion'
import { useVisualViewport } from '@/composables/useVisualViewport'
import FacetSections from './FacetSections.vue'
import FacetTabs from './FacetTabs.vue'

interface FacetSheetOption {
  readonly value: string
  readonly label: string
  readonly count: number
}

export interface FacetSheetGroup {
  readonly key: string
  readonly label: string
  readonly options: readonly FacetSheetOption[]
  readonly selected: readonly string[]
}

interface FacetSheetLabels {
  readonly title: string
  readonly search: string
  readonly noMatches: string
  readonly applied: (count: number) => string
  readonly clearAll: string
  readonly show: (count: number) => string
  readonly close: string
  readonly resize: string
}

// One facet picker for the whole prototype. Both catalogues narrow the same
// way on a phone, so the tabs, the rows, the empty state and the way out are
// decided here once rather than in each listing.
const { groups, labels, resultCount } = defineProps<{
  groups: readonly FacetSheetGroup[]
  labels: FacetSheetLabels
  /** What the catalogue holds under the current choices, for the way out. */
  resultCount: number
}>()

const emit = defineEmits<{
  toggle: [group: string, value: string]
  clearAll: []
  close: []
}>()

const SEARCHABLE_FROM = 8

// A short list reads at a glance, so it stands in sections with no search;
// a long one keeps a tab per group and a way to find an option by name.
const stacked = computed(
  () =>
    groups.reduce((total, group) => total + group.options.length, 0) <
    SEARCHABLE_FROM
)

const selectedCount = computed(() =>
  groups.reduce((total, group) => total + group.selected.length, 0)
)

// The handle is the only way to make the sheet taller, so it drags rather than
// decorates: a pull settles at the nearest rest, and a pull past the bottom
// puts the sheet away.
const onPhone = useMediaQuery('(width < 40rem)')
const { height: windowHeight } = useWindowSize()
const { height: visualHeight } = useVisualViewport()
const viewport = computed(() => visualHeight.value ?? windowHeight.value)
const rest = ref<Exclude<SheetRest, 'closed'>>('collapsed')
const dragged = ref<number | null>(null)
const grab = ref<{
  pointerId: number
  y: number
  height: number
  moved: boolean
} | null>(null)
const suppressClick = ref(false)

const sheetHeight = computed(() =>
  onPhone.value
    ? (dragged.value ?? heightAt(rest.value, viewport.value))
    : undefined
)

function startDrag(event: PointerEvent) {
  if (grab.value || !event.isPrimary) return
  if (event.currentTarget instanceof HTMLElement)
    event.currentTarget.setPointerCapture(event.pointerId)
  grab.value = {
    pointerId: event.pointerId,
    y: event.clientY,
    height: sheetHeight.value ?? 0,
    moved: false
  }
}

function drag(event: PointerEvent) {
  const from = grab.value
  if (!from || event.pointerId !== from.pointerId) return
  const travelled = from.y - event.clientY
  if (Math.abs(travelled) > 4) from.moved = true
  dragged.value = Math.min(Math.max(from.height + travelled, 0), viewport.value)
}

function toggleRest() {
  rest.value = rest.value === 'expanded' ? 'collapsed' : 'expanded'
}

function toggleFromClick() {
  if (suppressClick.value) {
    suppressClick.value = false
    return
  }
  toggleRest()
}

function releasePointer(event: PointerEvent) {
  if (
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.hasPointerCapture(event.pointerId)
  )
    event.currentTarget.releasePointerCapture(event.pointerId)
}

function endDrag(event: PointerEvent) {
  const from = grab.value
  if (!from || event.pointerId !== from.pointerId) return
  releasePointer(event)
  grab.value = null
  const reached = dragged.value ?? 0
  dragged.value = null
  if (!from.moved) return
  suppressClick.value = true
  const settled = restAt(reached / viewport.value)
  if (settled === 'closed') emit('close')
  else rest.value = settled
}

function cancelDrag(event: PointerEvent) {
  const from = grab.value
  if (!from || event.pointerId !== from.pointerId) return
  releasePointer(event)
  grab.value = null
  dragged.value = null
  suppressClick.value = false
}
</script>

<template>
  <div
    :class="
      cn(
        'flex min-h-0 flex-col',
        !grab && !prefersReducedMotion() && 'max-sm:transition-all'
      )
    "
    :style="{
      height: sheetHeight !== undefined ? `${sheetHeight}px` : undefined
    }"
  >
    <div class="shrink-0 sm:hidden" data-testid="workshop-filter-grip">
      <button
        type="button"
        :aria-label="labels.resize"
        :aria-expanded="rest === 'expanded'"
        class="mx-auto flex h-6 w-16 cursor-grab touch-none items-center justify-center"
        data-testid="workshop-filter-grabber"
        @click="toggleFromClick"
        @pointerdown="startDrag"
        @pointermove="drag"
        @pointerup="endDrag"
        @pointercancel="cancelDrag"
      >
        <span class="h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
      </button>

      <div class="flex items-center justify-between px-4 pt-1 pb-5">
        <h2 class="text-base font-bold text-content">{{ labels.title }}</h2>
        <button
          type="button"
          :aria-label="labels.close"
          class="grid size-9 cursor-pointer place-items-center rounded-xl bg-white/8 text-content-secondary hover:text-content"
          data-testid="workshop-filter-close"
          @click="emit('close')"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <FacetSections
      v-if="stacked"
      :groups
      :no-matches="labels.noMatches"
      @toggle="(key, value) => emit('toggle', key, value)"
    />
    <FacetTabs
      v-else
      :groups
      :search-label="labels.search"
      :no-matches="labels.noMatches"
      @toggle="(key, value) => emit('toggle', key, value)"
    />

    <div
      v-if="selectedCount"
      class="flex items-center justify-between gap-3 border-t border-white/10 p-2 max-sm:hidden"
    >
      <span
        class="px-1 text-xs text-content-secondary"
        data-testid="workshop-filter-applied"
      >
        {{ labels.applied(selectedCount) }}
      </span>
      <button
        type="button"
        data-testid="workshop-filter-clear"
        class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-content-secondary transition-colors hover:bg-white/5 hover:text-content"
        @click="emit('clearAll')"
      >
        {{ labels.clearAll }}
      </button>
    </div>

    <!-- The sheet applies as you tap, so its button is a way out that says
      what is waiting behind it. -->
    <div
      class="flex items-center gap-3 border-t border-white/10 p-3 sm:hidden"
      data-testid="workshop-filter-footer"
    >
      <button
        v-if="selectedCount"
        type="button"
        data-testid="workshop-filter-sheet-clear"
        class="shrink-0 cursor-pointer px-2 text-sm text-primary-warm-gray hover:text-primary-warm-white"
        @click="emit('clearAll')"
      >
        {{ labels.clearAll }}
      </button>
      <button
        type="button"
        class="h-11 flex-1 cursor-pointer rounded-2xl bg-primary-comfy-yellow text-sm font-bold text-primary-comfy-ink hover:bg-primary-comfy-yellow/90"
        data-testid="workshop-filter-show"
        @click="resultCount > 0 ? emit('close') : emit('clearAll')"
      >
        {{ resultCount > 0 ? labels.show(resultCount) : labels.clearAll }}
      </button>
    </div>
  </div>
</template>

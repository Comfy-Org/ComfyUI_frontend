<script setup lang="ts">
import { X } from '@lucide/vue'
import { useEventListener, useMutationObserver } from '@vueuse/core'
import { computed, nextTick, onMounted, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { DesignDecision } from './design-decisions'
import { DESIGN_DECISIONS } from './design-decisions'

const { enabled, locale = 'en' } = defineProps<{
  enabled: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

interface Placed {
  readonly anchor: string
  readonly number: number
  readonly x: number
  readonly y: number
}

const live = ref(false)
const shown = ref<DesignDecision[]>([])
const placed = ref<Placed[]>([])
const panelOpen = ref(false)
const active = ref<string>()
let frame = 0

const numbered = computed(() =>
  shown.value.map((decision, index) => ({ decision, number: index + 1 }))
)

function anchorOf(decision: DesignDecision) {
  return document.querySelector<HTMLElement>(
    `[data-design-decision="${decision.anchor}"]`
  )
}

function measure() {
  frame = 0
  const page = DESIGN_DECISIONS.find((decision) => anchorOf(decision))?.page
  shown.value = DESIGN_DECISIONS.filter((decision) => decision.page === page)
  placed.value = shown.value.flatMap((decision, index) => {
    const box = anchorOf(decision)?.getBoundingClientRect()
    return box
      ? [
          {
            anchor: decision.anchor,
            number: index + 1,
            x: box.left,
            y: box.top
          }
        ]
      : []
  })
}

function schedule() {
  if (live.value && !frame) frame = requestAnimationFrame(measure)
}

onMounted(() => {
  live.value = enabled && !navigator.webdriver
  if (live.value) measure()
})
useEventListener('scroll', schedule, { capture: true, passive: true })
useEventListener('resize', schedule, { passive: true })
useMutationObserver(() => (live.value ? document.body : null), schedule, {
  childList: true,
  subtree: true
})

function toggle() {
  panelOpen.value = !panelOpen.value
  active.value = undefined
  if (panelOpen.value) measure()
}

async function openAt(anchor: string) {
  active.value = anchor
  panelOpen.value = true
  await nextTick()
  document
    .getElementById(`design-decision-${anchor}`)
    ?.scrollIntoView({ block: 'nearest' })
}
</script>

<template>
  <template v-if="live && shown.length">
    <template v-if="panelOpen">
      <button
        v-for="dot in placed"
        :key="dot.anchor"
        type="button"
        :aria-label="t('designDecisions.dot', { n: dot.number })"
        class="fixed z-50 flex size-6 -translate-1/2 cursor-pointer items-center justify-center rounded-full bg-primary-comfy-yellow text-xs font-bold text-primary-comfy-ink shadow-lg ring-2 ring-page outline-none focus-visible:ring-primary-warm-white"
        :style="{ left: `${dot.x}px`, top: `${dot.y}px` }"
        data-testid="design-decision-dot"
        @click="openAt(dot.anchor)"
      >
        {{ dot.number }}
      </button>
    </template>

    <button
      type="button"
      :aria-expanded="panelOpen"
      class="fixed right-6 bottom-6 z-40 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-transparency-white-t8 bg-page/90 pr-1.5 pl-3 text-xs font-medium text-primary-comfy-canvas shadow-lg backdrop-blur-sm outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      data-testid="design-decisions-toggle"
      @click="toggle"
    >
      {{ t('designDecisions.button') }}
      <span
        class="inline-flex size-5 items-center justify-center rounded-full bg-transparency-white-t8 text-2xs tabular-nums"
      >
        {{ shown.length }}
      </span>
    </button>

    <aside
      v-if="panelOpen"
      :aria-label="t('designDecisions.title')"
      class="fixed right-6 bottom-16 z-50 flex max-h-[min(32rem,calc(100dvh-6rem))] w-96 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 bg-page text-primary-comfy-canvas shadow-2xl"
      data-testid="design-decisions-panel"
    >
      <div
        class="flex items-center justify-between border-b border-transparency-white-t8 px-5 py-4"
      >
        <h2 class="text-base font-semibold text-primary-warm-white">
          {{ t('designDecisions.title') }}
        </h2>
        <button
          type="button"
          :aria-label="t('designDecisions.close')"
          class="grid size-8 cursor-pointer place-items-center rounded-lg outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          @click="panelOpen = false"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>
      <ol class="flex flex-col gap-3 overflow-y-auto p-5">
        <li
          v-for="{ decision, number } in numbered"
          :id="`design-decision-${decision.anchor}`"
          :key="decision.anchor"
          :class="
            cn(
              'flex gap-3 rounded-xl p-3',
              active === decision.anchor && 'bg-transparency-white-t8'
            )
          "
        >
          <span
            aria-hidden="true"
            class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-comfy-yellow text-xs font-bold text-primary-comfy-ink"
          >
            {{ number }}
          </span>
          <div class="flex flex-col gap-1">
            <h3 class="text-sm font-semibold text-primary-warm-white">
              {{ t(decision.titleKey) }}
            </h3>
            <p class="text-sm leading-relaxed">{{ t(decision.bodyKey) }}</p>
          </div>
        </li>
      </ol>
      <p
        class="border-t border-transparency-white-t8 px-5 py-4 text-xs text-primary-warm-gray"
      >
        {{ t('designDecisions.footer') }}
      </p>
    </aside>
  </template>
</template>

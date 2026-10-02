<script setup lang="ts">
import { Minus, Orbit, X } from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import { ref } from 'vue'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { Light } from '../../../lib/workshop/relight/lights'
import RelightMapView from './RelightMapView.vue'

const {
  lights,
  selected,
  locale = 'en'
} = defineProps<{
  lights: readonly Light[]
  selected?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  change: [id: string, patch: Partial<Light>]
  hide: []
}>()

const wide = useMediaQuery('(min-width: 640px)')
const expanded = ref(false)
const VIEWS = [
  { view: 'top', label: 'relight.map.top' },
  { view: 'side', label: 'relight.map.side' }
] as const
</script>

<template>
  <div
    role="group"
    :aria-label="lc('relight.map', locale)"
    data-testid="relight-light-map"
  >
    <button
      v-if="!wide && !expanded"
      type="button"
      aria-expanded="false"
      class="pointer-events-auto flex h-8 items-center gap-1.5 rounded-full border border-transparency-white-t8 bg-primary-comfy-ink-light/90 px-2.5 text-[11px] text-primary-warm-white shadow-lg shadow-black/30 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      @click="expanded = true"
    >
      <Orbit class="size-3.5" aria-hidden="true" />
      {{ lc('relight.map', locale) }}
    </button>
    <div
      v-else
      class="rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink-light/85 p-1.5 shadow-lg shadow-black/30 backdrop-blur-sm"
    >
      <div class="flex items-center justify-between pl-1.5">
        <span class="text-[11px] text-primary-warm-gray">{{
          lc('relight.map', locale)
        }}</span>
        <button
          v-if="wide"
          type="button"
          :aria-label="lc('relight.map.hide', locale)"
          class="pointer-events-auto grid size-6 place-items-center rounded-full text-primary-warm-gray transition hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          @click="emit('hide')"
        >
          <X class="size-3.5" aria-hidden="true" />
        </button>
        <button
          v-else
          type="button"
          aria-expanded="true"
          :aria-label="lc('relight.map.collapse', locale)"
          class="pointer-events-auto grid size-6 place-items-center rounded-full text-primary-warm-gray transition hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          @click="expanded = false"
        >
          <Minus class="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <div class="flex gap-1">
        <figure
          v-for="{ view, label } in VIEWS"
          :key="view"
          class="flex flex-col items-center"
        >
          <RelightMapView
            :view
            :lights
            :selected
            :locale
            @select="(id) => emit('select', id)"
            @change="(id, patch) => emit('change', id, patch)"
          />
          <figcaption class="text-[10px] text-primary-warm-gray">
            {{ lc(label, locale) }}
          </figcaption>
        </figure>
      </div>
    </div>
  </div>
</template>

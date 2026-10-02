<script setup lang="ts">
import { ArrowRight, Search } from '@lucide/vue'
import { computed, ref, useId } from 'vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import type { Star } from '../../../lib/workshop/paparazzi-me/setup'
import {
  STARS,
  hasCelebrity,
  matchStars
} from '../../../lib/workshop/paparazzi-me/setup'
import PaparazziStarOption from './PaparazziStarOption.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { setup, search } = paparazzi
const id = useId()
const open = ref(false)
const active = ref(0)
const query = computed(() => setup.value.celebrity)
const suggestions = computed(() =>
  STARS.some((star) => star.name === query.value.trim())
    ? STARS
    : matchStars(query.value)
)
const note = computed(() =>
  hasCelebrity(query.value)
    ? pc('paparazzi.star.hint', locale)
    : pc('paparazzi.star.short', locale)
)
const searching = computed(() => search.value.kind === 'searching')
const expanded = computed(() => open.value && suggestions.value.length > 0)

function type(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  paparazzi.change({ celebrity: event.target.value }, 'celebrity')
  open.value = true
  active.value = 0
}

function pick(star: Star) {
  paparazzi.change({ celebrity: star.name })
  open.value = false
  void paparazzi.findScenes()
}

function move(step: number) {
  open.value = true
  const count = suggestions.value.length
  if (count) active.value = (active.value + step + count) % count
}

function choose() {
  const star = suggestions.value[active.value]
  if (expanded.value && star) pick(star)
  else void paparazzi.findScenes()
  open.value = false
}
</script>

<template>
  <div class="flex flex-col gap-2 px-1">
    <label :for="id" class="text-xs text-primary-warm-gray">{{
      pc('paparazzi.star.label', locale)
    }}</label>
    <div class="relative">
      <Search
        class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-primary-warm-gray"
        aria-hidden="true"
      />
      <input
        :id
        :value="query"
        type="text"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        :aria-expanded="expanded"
        :aria-controls="`${id}-list`"
        :aria-activedescendant="expanded ? `${id}-${active}` : undefined"
        :placeholder="pc('paparazzi.star.placeholder', locale)"
        class="h-9 w-full rounded-lg bg-transparency-white-t4 pr-10 pl-8 text-[13px] text-primary-warm-white placeholder:text-primary-warm-gray/60 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
        @input="type"
        @focus="open = true"
        @blur="open = false"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="choose"
        @keydown.esc="open = false"
      />
      <button
        type="button"
        :aria-label="pc('paparazzi.star.find', locale)"
        :disabled="!hasCelebrity(query) || searching"
        class="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-md text-primary-warm-gray transition hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
        @click="paparazzi.findScenes"
      >
        <span
          v-if="searching"
          class="size-3.5 rounded-full border-2 border-transparency-white-t20 border-t-primary-comfy-yellow motion-safe:animate-spin"
          aria-hidden="true"
        />
        <ArrowRight v-else class="size-3.5" aria-hidden="true" />
      </button>
    </div>
    <ul
      v-show="expanded"
      :id="`${id}-list`"
      role="listbox"
      :aria-label="pc('paparazzi.star.suggestions', locale)"
      class="flex flex-col gap-0.5"
    >
      <PaparazziStarOption
        v-for="(star, index) in suggestions"
        :id="`${id}-${index}`"
        :key="star.name"
        :name="star.name"
        :role-label="pc(star.role, locale)"
        :active="index === active"
        :selected="star.name === query.trim()"
        @pick="pick(star)"
      />
    </ul>
    <p v-if="note" class="text-[11px] text-primary-warm-gray">{{ note }}</p>
  </div>
</template>

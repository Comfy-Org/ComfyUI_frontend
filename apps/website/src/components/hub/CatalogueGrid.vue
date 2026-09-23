<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'
import type { BrowseEntry } from '../../lib/hub/browse-entry'
import type { Shelf } from '../../lib/workshop/shelf-memory'
import { rememberShelfOnClick } from '../../lib/workshop/shelf-memory'
import CatalogueCard from './CatalogueCard.vue'

const {
  visible,
  total,
  shelf,
  locale = 'en'
} = defineProps<{
  visible: readonly BrowseEntry[]
  /** Everything the narrowing matched, of which `visible` is the first page. */
  total: number
  /** The use case this listing is narrowed to, so a card can offer it back. */
  shelf: Shelf
  locale?: Locale
}>()

const emit = defineEmits<{ more: [] }>()

// The list ends where the catalogue ends, not where a button does: reaching
// the foot of what is drawn is itself the request for the rest.
const foot = useTemplateRef<HTMLElement>('foot')

useIntersectionObserver(
  foot,
  ([entry]) => {
    if (entry?.isIntersecting) emit('more')
  },
  { rootMargin: '600px' }
)

const showingText = computed(() =>
  tHub('workshop.v2.showing', locale)
    .replace('{shown}', String(visible.length))
    .replace('{total}', String(total))
)
</script>

<template>
  <div
    v-if="visible.length > 0"
    class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    data-testid="catalogue-grid"
  >
    <CatalogueCard
      v-for="entry in visible"
      :key="entry.key"
      :view="entry.card"
      :locale
      @click="rememberShelfOnClick($event, shelf, entry.card.href)"
    />
  </div>
  <div
    v-else
    class="py-20 text-center text-content-muted"
    data-testid="catalogue-empty"
  >
    <p class="text-lg">{{ tHub('workshop.v2.empty', locale) }}</p>
    <p class="mt-2 text-sm">{{ tHub('workshop.v2.emptyHint', locale) }}</p>
  </div>

  <div
    v-if="visible.length < total"
    ref="foot"
    class="h-px"
    aria-hidden="true"
    data-testid="catalogue-foot"
  />

  <p
    v-if="visible.length > 0"
    class="pt-2 pb-4 text-center text-sm text-hub-muted"
    data-testid="catalogue-showing"
  >
    {{ showingText }}
  </p>
</template>

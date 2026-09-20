<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
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

const showingText = computed(() =>
  t('workshop.v2.showing', locale)
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
    <p class="text-lg">{{ t('workshop.v2.empty', locale) }}</p>
    <p class="mt-2 text-sm">{{ t('workshop.v2.emptyHint', locale) }}</p>
  </div>

  <div v-if="visible.length < total" class="flex justify-center pt-10 pb-4">
    <button
      type="button"
      class="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-brand px-12 text-sm font-semibold tracking-wider text-brand uppercase transition-colors hover:bg-brand hover:text-page"
      data-testid="catalogue-load-more"
      @click="emit('more')"
    >
      {{ t('workshop.v2.loadMore', locale) }}
    </button>
  </div>

  <p
    v-if="visible.length > 0"
    class="pt-2 pb-4 text-center text-sm text-hub-muted"
    data-testid="catalogue-showing"
  >
    {{ showingText }}
  </p>
</template>

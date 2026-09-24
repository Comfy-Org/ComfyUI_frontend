<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { tHub } from '../../i18n/hub'
import type { BrowseEntry } from '../../lib/hub/browse-entry'
import { sortBrowseEntries } from '../../lib/hub/browse-entry'
import type { CatalogueShelf } from '../../lib/hub/shelves'
import CardRow from '../workshop/CardRow.vue'
import { rememberShelfOnClick } from '../../lib/workshop/shelf-memory'
import CatalogueCard from './CatalogueCard.vue'

const ROW_LIMIT = 8

// The axis the half is read through, in the order the reader meets it. The
// two halves shelve differently, so the page that knows which tab it is in
// passes the axis rather than this component choosing one.
const {
  entries,
  shelves,
  locale = 'en'
} = defineProps<{
  entries: readonly BrowseEntry[]
  shelves: readonly CatalogueShelf[]
  locale?: Locale
}>()

const emit = defineEmits<{ open: [string]; openAll: [] }>()

const rows = computed(() =>
  shelves
    .map((shelf) => {
      const matches = sortBrowseEntries(
        entries.filter((entry) => entry.shelves.includes(shelf.key)),
        'popular'
      )
      return {
        key: shelf.key,
        labelKey: shelf.labelKey,
        total: matches.length,
        shown: matches.slice(0, ROW_LIMIT)
      }
    })
    .filter((shelf) => shelf.total > 0)
)

const titleClass =
  'cursor-pointer rounded-lg text-xl font-medium text-primary-warm-white transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'

const seeAllClass =
  'group inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'

const cardClass = 'peek-card shrink-0 snap-start'

// The shelves name the ways in; somebody who wants the half entire has none of
// them, so the way past them stands at the foot rather than competing with the
// rows above it.
const total = computed(() => entries.length)

const kindLabelKey: Record<string, HubKey> = {
  model: 'workshop.v2.kind.models',
  workflow: 'workshop.v2.kind.workflows'
}

// Both tabs are shelves, so the way past them says which half it opens.
const browseAllLabel = computed(() =>
  tHub('workshop.v2.browseAll', locale)
    .replace('{n}', `${total.value}`)
    .replace(
      '{kind}',
      tHub(kindLabelKey[entries[0]?.kind ?? 'model'], locale).toLowerCase()
    )
)
</script>

<template>
  <div class="flex flex-col gap-12" data-testid="hub-sections">
    <section
      v-for="shelf in rows"
      :key="shelf.key"
      :aria-labelledby="`shelf-${shelf.key}`"
      :data-testid="`shelf-${shelf.key}`"
    >
      <CardRow :locale>
        <template #heading>
          <h2 :id="`shelf-${shelf.key}`">
            <button
              type="button"
              :class="titleClass"
              :data-testid="`shelf-${shelf.key}-open`"
              @click="emit('open', shelf.key)"
            >
              {{ tHub(shelf.labelKey, locale) }}
            </button>
          </h2>
        </template>

        <template #actions>
          <button
            v-if="shelf.total > shelf.shown.length"
            type="button"
            :class="seeAllClass"
            :data-testid="`shelf-${shelf.key}-see-all`"
            @click="emit('open', shelf.key)"
          >
            <span class="tabular-nums">
              {{
                tHub('workshop.sections.seeAll', locale).replace(
                  '{n}',
                  `${shelf.total}`
                )
              }}
            </span>
            <ChevronRight
              class="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </template>

        <li
          v-for="entry in shelf.shown"
          :key="entry.key"
          :class="cardClass"
          @click="rememberShelfOnClick($event, 'all', entry.card.href)"
        >
          <CatalogueCard :view="entry.card" :locale />
        </li>
      </CardRow>
    </section>

    <div class="flex justify-center">
      <button
        type="button"
        class="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-transparency-white-t20 px-6 py-3 text-sm font-medium text-primary-warm-white transition-colors outline-none hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="hub-browse-all"
        @click="emit('openAll')"
      >
        {{ browseAllLabel }}
        <ChevronRight class="size-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

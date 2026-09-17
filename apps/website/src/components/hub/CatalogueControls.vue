<script setup lang="ts">
import { ArrowUpDown, ChevronDown, ListFilter } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import { onClickOutside, useMediaQuery } from '@vueuse/core'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { CatalogueOrder } from '../../lib/hub/browse-entry'
import type { EntryKind } from '../../lib/hub/catalogue-entries'
import type { FacetSheetGroup } from '../workshop/FacetSheet.vue'
import FacetSheet from '../workshop/FacetSheet.vue'

export interface OrderOption {
  readonly value: CatalogueOrder
  readonly label: TranslationKey
  readonly only?: EntryKind
}

const {
  orders,
  groups,
  filtersOn,
  resultCount,
  locale = 'en'
} = defineProps<{
  orders: readonly OrderOption[]
  /** Each facet with what choosing an option would return, not how many exist. */
  groups: readonly FacetSheetGroup[]
  filtersOn: boolean
  resultCount: number
  locale?: Locale
}>()

const emit = defineEmits<{ clear: []; pick: [group: string, value: string] }>()

const order = defineModel<CatalogueOrder>('order', { required: true })

// A dropdown anchored to a crowded toolbar leaves a phone no room, so there the
// facets rise from the bottom of the screen instead, the way the models
// listing does it.
const isPhone = useMediaQuery('(width < 40rem)')
const open = ref(false)
const filters = useTemplateRef('filters')

onClickOutside(filters, () => {
  if (!isPhone.value) open.value = false
})

watchEffect((onCleanup) => {
  if (!open.value || !isPhone.value) return
  const previous = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  onCleanup(() => (document.body.style.overflow = previous))
})

const orderLabel = computed(
  () =>
    orders.find((option) => option.value === order.value)?.label ??
    orders[0].label
)

const chosenCount = computed(
  () => groups.filter((group) => group.selected.length > 0).length
)

const control =
  'inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl bg-transparency-white-t4 px-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:h-10 max-sm:rounded-xl'

const menuItem =
  'flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-content-secondary outline-none select-none hover:bg-transparency-white-t4 hover:text-content-bright focus-visible:bg-transparency-white-t4'

const sheetLabels = computed(() => ({
  title: t('workshop.v2.filter.label', locale),
  search: t('workshop.hub.facets.search', locale),
  noMatches: t('workshop.hub.facets.noResults', locale),
  applied: t('workshop.filter.applied', locale),
  clearAll: t('workshop.v2.clear', locale),
  show: t('workshop.v2.filter.show', locale),
  close: t('workshop.v2.filter.label', locale),
  resize: t('workshop.filter.resize', locale)
}))
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-2"
    data-testid="catalogue-controls"
  >
    <div ref="filters" class="relative">
      <button
        type="button"
        :class="cn(control, filtersOn && 'text-primary-comfy-yellow')"
        :aria-expanded="open"
        data-testid="catalogue-filter-toggle"
        @click="open = !open"
      >
        <ListFilter class="size-4 shrink-0" aria-hidden="true" />
        <span class="max-sm:hidden">
          {{ t('workshop.v2.filter.label', locale) }}
        </span>
        <span
          v-if="chosenCount > 0"
          class="rounded-full bg-primary-comfy-yellow px-1.5 text-2xs/5 font-bold text-primary-comfy-ink tabular-nums"
        >
          {{ chosenCount }}
        </span>
      </button>

      <div
        v-if="open && !isPhone"
        class="absolute inset-e-0 top-full z-50 mt-2 flex max-h-panel scrollbar-thin w-80 flex-col gap-4 overflow-y-auto rounded-2xl border border-primary-comfy-ink-light bg-site-dropdown p-5 shadow-lg"
        data-testid="catalogue-filter-panel"
      >
        <FacetSheet
          :groups
          :labels="sheetLabels"
          :result-count="resultCount"
          @toggle="(group, value) => emit('pick', group, value)"
          @clear-all="emit('clear')"
          @close="open = false"
        />
      </div>
    </div>

    <DropdownMenuRoot>
      <DropdownMenuTrigger
        :class="cn(control, 'group')"
        :aria-label="t('workshop.v2.sort.label', locale)"
        data-testid="catalogue-sort"
      >
        <ArrowUpDown class="size-4 shrink-0" aria-hidden="true" />
        <span class="max-sm:hidden">{{ t(orderLabel, locale) }}</span>
        <ChevronDown
          class="size-4 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180 max-sm:hidden"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          :side-offset="8"
          class="z-50 w-60 rounded-2xl border border-primary-comfy-ink-light bg-site-dropdown p-2 shadow-lg"
        >
          <DropdownMenuRadioGroup v-model="order">
            <DropdownMenuRadioItem
              v-for="option in orders"
              :key="option.value"
              :value="option.value"
              :data-testid="`catalogue-sort-${option.value}`"
              :class="
                cn(
                  menuItem,
                  order === option.value &&
                    'bg-transparency-white-t8 text-content-bright'
                )
              "
            >
              {{ t(option.label, locale) }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <button
      v-if="filtersOn"
      type="button"
      class="cursor-pointer text-xs text-content-muted underline underline-offset-4 transition-colors hover:text-content-bright max-sm:hidden"
      data-testid="catalogue-clear"
      @click="emit('clear')"
    >
      {{ t('workshop.v2.clear', locale) }}
    </button>

    <Teleport to="body">
      <div
        v-if="open && isPhone"
        class="fixed inset-0 z-40 bg-black/60"
        data-testid="catalogue-sheet-backdrop"
        @click="open = false"
      />
      <div
        v-if="open && isPhone"
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-panel scrollbar-thin flex-col gap-4 overflow-y-auto rounded-t-3xl border border-white/10 bg-site-dropdown p-5 shadow-2xl"
        data-testid="catalogue-sheet"
      >
        <FacetSheet
          :groups
          :labels="sheetLabels"
          :result-count="resultCount"
          @toggle="(group, value) => emit('pick', group, value)"
          @clear-all="emit('clear')"
          @close="open = false"
        />
      </div>
    </Teleport>
  </div>
</template>

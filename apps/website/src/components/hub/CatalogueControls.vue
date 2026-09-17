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
import { computed, ref, watchEffect } from 'vue'

import { useMediaQuery } from '@vueuse/core'

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

const chosenIn = (group: FacetSheetGroup) =>
  group.options.find((option) => group.selected.includes(option.value))

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
    <button
      type="button"
      :class="
        cn(control, 'sm:hidden', filtersOn && 'text-primary-comfy-yellow')
      "
      :aria-expanded="open"
      data-testid="catalogue-filter-toggle"
      @click="open = !open"
    >
      <ListFilter class="size-4 shrink-0" aria-hidden="true" />
      <span class="max-sm:hidden">
        {{ t('workshop.v2.filter.label', locale) }}
      </span>
    </button>

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

    <!-- On a wide toolbar each facet is its own button, so what is narrowing
      the grid is readable without opening anything. -->
    <DropdownMenuRoot v-for="group in groups" :key="group.key">
      <DropdownMenuTrigger
        :class="
          cn(
            control,
            'group max-sm:hidden',
            chosenIn(group) && 'text-primary-comfy-yellow'
          )
        "
        :data-testid="`catalogue-facet-${group.key}`"
      >
        {{ chosenIn(group)?.label ?? group.label }}
        <ChevronDown
          class="size-4 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          :side-offset="8"
          class="z-50 max-h-80 scrollbar-thin w-60 overflow-y-auto rounded-2xl border border-primary-comfy-ink-light bg-site-dropdown p-2 shadow-lg"
        >
          <DropdownMenuRadioGroup
            :model-value="chosenIn(group)?.value ?? group.options[0]?.value"
            @update:model-value="emit('pick', group.key, String($event))"
          >
            <DropdownMenuRadioItem
              v-for="option in group.options"
              :key="option.value"
              :value="option.value"
              :class="
                cn(
                  menuItem,
                  'justify-between gap-3',
                  group.selected.includes(option.value) &&
                    'bg-transparency-white-t8 text-content-bright'
                )
              "
            >
              <span class="min-w-0 truncate">{{ option.label }}</span>
              <span class="text-2xs tabular-nums opacity-70">
                {{ option.count }}
              </span>
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
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] scrollbar-thin flex-col gap-4 overflow-y-auto rounded-t-3xl border border-white/10 bg-site-dropdown p-5 shadow-2xl"
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

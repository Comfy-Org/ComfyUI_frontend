<script setup lang="ts">
import { Check, ChevronDown, Search } from '@lucide/vue'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface FacetMenuOption {
  readonly value: string
  readonly label: string
  readonly count: number
}

const {
  facet,
  label,
  options,
  locale = 'en',
  searchable = false
} = defineProps<{
  facet: string
  label: string
  options: readonly FacetMenuOption[]
  locale?: Locale
  searchable?: boolean
}>()

const selected = defineModel<string[]>({ required: true })
const query = ref('')

const visibleOptions = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options
})

// The menu's typeahead must not swallow typing, but Escape still closes it.
function stopTypeaheadKeys(event: KeyboardEvent) {
  if (event.key !== 'Escape') event.stopPropagation()
}

function toggle(value: string) {
  selected.value = selected.value.includes(value)
    ? selected.value.filter((item) => item !== value)
    : [...selected.value, value]
}

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-primary-comfy-canvas outline-none select-none data-[highlighted]:bg-transparency-white-t8'
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :data-testid="`workshop-filter-${facet}`"
      :class="
        cn(
          'hover:bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
          selected.length
            ? 'border-primary-comfy-yellow text-primary-warm-white'
            : 'border-transparency-white-t20 text-primary-comfy-canvas'
        )
      "
    >
      {{ label }}
      <span
        v-if="selected.length"
        class="bg-primary-comfy-yellow rounded-full px-1.5 text-[10px] font-bold text-primary-comfy-ink"
        :data-testid="`workshop-filter-${facet}-count`"
      >
        {{ selected.length }}
      </span>
      <ChevronDown class="size-4" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="start"
        :side-offset="8"
        class="border-primary-comfy-ink-light bg-site-dropdown z-50 flex max-h-[70vh] w-64 flex-col rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <div v-if="searchable" class="relative mb-2">
          <Search
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary-warm-gray"
            aria-hidden="true"
          />
          <input
            v-model="query"
            type="search"
            :placeholder="t('workshop.filter.search', locale)"
            :aria-label="t('workshop.filter.search', locale)"
            :data-testid="`workshop-filter-${facet}-search`"
            class="bg-transparency-white-t4 h-9 w-full rounded-xl border border-transparency-white-t20 pr-3 pl-9 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray [&::-webkit-search-cancel-button]:hidden"
            @keydown="stopTypeaheadKeys"
          />
        </div>
        <div class="min-h-0 overflow-y-auto">
          <DropdownMenuCheckboxItem
            v-for="option in visibleOptions"
            :key="option.value"
            :model-value="selected.includes(option.value)"
            :data-testid="`filter-${facet}-${option.value}`"
            :class="itemClass"
            @select.prevent
            @update:model-value="toggle(option.value)"
          >
            <span
              :class="
                cn(
                  'grid size-4 shrink-0 place-items-center rounded-sm border',
                  selected.includes(option.value)
                    ? 'border-primary-comfy-yellow bg-primary-comfy-yellow text-primary-comfy-ink'
                    : 'border-transparency-white-t20'
                )
              "
            >
              <Check
                v-if="selected.includes(option.value)"
                class="size-3"
                aria-hidden="true"
              />
            </span>
            <span class="flex-1">{{ option.label }}</span>
            <span class="text-primary-warm-gray">{{ option.count }}</span>
          </DropdownMenuCheckboxItem>
        </div>
        <template v-if="selected.length">
          <DropdownMenuSeparator class="my-2 h-px bg-transparency-white-t8" />
          <DropdownMenuItem
            :class="cn(itemClass, 'text-primary-warm-gray')"
            :data-testid="`workshop-filter-${facet}-clear`"
            @select="selected = []"
          >
            {{ t('workshop.filter.clearOne', locale) }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

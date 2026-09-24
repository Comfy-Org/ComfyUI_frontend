<script setup lang="ts">
import { ArrowUpDown, ChevronDown } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { tHub } from '../../i18n/hub'
import type { CatalogueOrder, TypeFilter } from '../../lib/hub/browse-entry'

export interface OrderOption {
  readonly value: CatalogueOrder
  readonly label: HubKey
  readonly only?: TypeFilter
}

const { orders, locale = 'en' } = defineProps<{
  orders: readonly OrderOption[]
  locale?: Locale
}>()

const order = defineModel<CatalogueOrder>('order', { required: true })

const orderLabel = computed(
  () =>
    orders.find((option) => option.value === order.value)?.label ??
    orders[0].label
)

const control =
  'inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl bg-transparency-white-t4 px-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:h-10 max-sm:rounded-xl'

const menuItem =
  'flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-content-secondary outline-none select-none hover:bg-transparency-white-t4 hover:text-content-bright focus-visible:bg-transparency-white-t4'
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :class="cn(control, 'group')"
      :aria-label="tHub('workshop.v2.sort.label', locale)"
      data-testid="catalogue-sort"
    >
      <ArrowUpDown class="size-4 shrink-0" aria-hidden="true" />
      <span class="max-sm:hidden">{{ tHub(orderLabel, locale) }}</span>
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
            {{ tHub(option.label, locale) }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

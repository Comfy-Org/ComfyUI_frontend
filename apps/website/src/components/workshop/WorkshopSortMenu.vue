<script setup lang="ts">
import { ArrowUpDown, ChevronDown } from '@lucide/vue'
import { computed } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import type { SortOrder } from '../../config/models-catalogue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  orders,
  recommended = false,
  locale = 'en'
} = defineProps<{
  orders: readonly SortOrder[]
  recommended?: boolean
  locale?: Locale
}>()
const sort = defineModel<SortOrder>({ required: true })
const labels = computed<Record<SortOrder, TranslationKey>>(() => ({
  popular: recommended ? 'workshop.sort.recommended' : 'workshop.sort.popular',
  name: 'workshop.sort.name',
  priceAsc: 'workshop.sort.priceAsc',
  priceDesc: 'workshop.sort.priceDesc'
}))
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      data-testid="workshop-sort"
      :aria-label="t('workshop.sort.label', locale)"
      class="group inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl bg-transparency-white-t4 px-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:size-10 max-sm:justify-center max-sm:rounded-xl max-sm:bg-white/8 max-sm:px-0"
    >
      <ArrowUpDown class="size-4 shrink-0" aria-hidden="true" />
      <span class="max-sm:hidden">{{ t(labels[sort], locale) }}</span>
      <ChevronDown
        class="size-4 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180 max-sm:hidden"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="z-50 w-64 rounded-2xl border border-primary-comfy-ink-light bg-site-dropdown p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <DropdownMenuRadioGroup v-model="sort">
          <DropdownMenuRadioItem
            v-for="order in orders"
            :key="order"
            :value="order"
            :data-testid="`sort-${order}`"
            :class="
              cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-primary-comfy-canvas outline-none select-none data-highlighted:bg-transparency-white-t4',
                sort === order &&
                  'bg-transparency-white-t8 text-primary-warm-white'
              )
            "
          >
            <span class="flex-1">{{ t(labels[order], locale) }}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

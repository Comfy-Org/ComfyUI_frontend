<script setup lang="ts">
import { Check, ChevronDown, Monitor, Proportions } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { Resolution } from '@/lib/workshop/resolution'
import {
  MENU_HEADING,
  MENU_ITEM,
  MENU_ITEM_IDLE,
  MENU_ITEM_SELECTED,
  MENU_PANEL,
  MENU_TRIGGER
} from '@/lib/workshop/menu-classes'
import type { FacetMenuOption } from '@/components/workshop/WorkshopFilterMenu.vue'

const ALL = 'all'

const { options, locale = 'en' } = defineProps<{
  options: readonly FacetMenuOption<Resolution>[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selected = defineModel<Resolution | undefined>({ required: true })

const choice = computed({
  get: () => selected.value ?? ALL,
  set: (value: string) => {
    selected.value = options.find((option) => option.value === value)?.value
  }
})
const items = computed(() => [
  { value: ALL, label: t('workshop.resolution.all'), count: undefined },
  ...options
])
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger :class="MENU_TRIGGER" data-testid="resolution-menu">
      {{ selected ?? t('workshop.resolution.label') }}
      <ChevronDown
        class="size-3.5 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent align="start" :side-offset="8" :class="MENU_PANEL">
        <DropdownMenuLabel :class="MENU_HEADING">
          {{ t('workshop.resolution.label') }}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup v-model="choice">
          <DropdownMenuRadioItem
            v-for="item in items"
            :key="item.value"
            :value="item.value"
            :data-testid="`resolution-${item.value}`"
            :class="
              cn(
                MENU_ITEM,
                choice === item.value ? MENU_ITEM_SELECTED : MENU_ITEM_IDLE
              )
            "
          >
            <component
              :is="item.value === ALL ? Monitor : Proportions"
              class="size-4 shrink-0"
              aria-hidden="true"
            />
            <span class="flex-1">{{ item.label }}</span>
            <span
              v-if="item.count !== undefined"
              class="text-content/30 tabular-nums"
            >
              {{ item.count }}
            </span>
            <DropdownMenuItemIndicator>
              <Check
                class="size-4 text-primary-comfy-yellow"
                aria-hidden="true"
              />
            </DropdownMenuItemIndicator>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

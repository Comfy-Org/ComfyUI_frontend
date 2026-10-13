<script setup lang="ts">
import {
  AudioLines,
  BookOpen,
  Box,
  Check,
  ChevronDown,
  Clapperboard,
  Film,
  Image,
  Pencil,
  Video
} from '@lucide/vue'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import type { Component } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { UseCase } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { toggleIn } from '@/lib/workshop/facet-toggle'
import {
  MENU_HEADING,
  MENU_ITEM,
  MENU_ITEM_IDLE,
  MENU_ITEM_SELECTED,
  MENU_PANEL,
  MENU_TRIGGER
} from '@/lib/workshop/menu-classes'
import type { FacetMenuOption } from '@/components/workshop/WorkshopFilterMenu.vue'

const { options, locale = 'en' } = defineProps<{
  options: readonly FacetMenuOption[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selected = defineModel<UseCase[]>({ required: true })

const ICONS: Record<UseCase, Component> = {
  'generate-images': Image,
  'edit-images': Pencil,
  'generate-videos': Video,
  'animate-images': Clapperboard,
  'edit-videos': Film,
  audio: AudioLines,
  '3d': Box,
  text: BookOpen
}
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger :class="MENU_TRIGGER" data-testid="best-for-menu">
      {{ t('workshop.bestFor.label') }}
      <span
        v-if="selected.length"
        class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-comfy-yellow px-1 text-3xs leading-none font-bold text-primary-comfy-ink tabular-nums"
        data-testid="best-for-count"
      >
        {{ selected.length }}
      </span>
      <ChevronDown
        class="size-3.5 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent align="start" :side-offset="8" :class="MENU_PANEL">
        <DropdownMenuLabel :class="MENU_HEADING">
          {{ t('workshop.bestFor.label') }}
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          v-for="option in options"
          :key="option.value"
          :model-value="selected.includes(option.value)"
          :data-testid="`best-for-${option.value}`"
          :class="
            cn(
              MENU_ITEM,
              selected.includes(option.value)
                ? MENU_ITEM_SELECTED
                : MENU_ITEM_IDLE
            )
          "
          @select.prevent
          @update:model-value="selected = toggleIn(selected, option.value)"
        >
          <component
            :is="ICONS[option.value]"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
          <span class="flex-1">{{ option.label }}</span>
          <span class="text-content/30 tabular-nums">{{ option.count }}</span>
          <DropdownMenuItemIndicator>
            <Check
              class="size-4 text-primary-comfy-yellow"
              aria-hidden="true"
            />
          </DropdownMenuItemIndicator>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import { AudioLines, Box, Image, LayoutGrid, Pencil, Video } from '@lucide/vue'
import type { Component } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { HomeUseCaseGroup } from '@/lib/workshop/home-use-case-groups'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'

const { groups, locale = 'en' } = defineProps<{
  groups: readonly {
    readonly group: HomeUseCaseGroup
    readonly label: TranslationKey
  }[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selected = defineModel<HomeUseCaseGroup | 'all'>({ required: true })

const icon: Record<HomeUseCaseGroup | 'all', Component> = {
  all: LayoutGrid,
  image: Image,
  video: Video,
  edit: Pencil,
  '3d': Box,
  audio: AudioLines
}

const chips = computed(() => [
  { group: 'all' as const, label: useCaseLabelKey.all },
  ...groups
])
</script>

<template>
  <div class="-mx-1 overflow-x-auto px-1 py-1">
    <div
      class="inline-flex items-center gap-0.5 rounded-full bg-transparency-white-t4 p-1"
      role="group"
      :aria-label="t('workshop.explore.tasks')"
    >
      <button
        v-for="chip in chips"
        :key="chip.group"
        type="button"
        :class="
          cn(
            'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
            selected === chip.group
              ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
              : 'text-primary-comfy-canvas hover:bg-transparency-white-t8 hover:text-primary-warm-white'
          )
        "
        :aria-pressed="selected === chip.group"
        @click="selected = chip.group"
      >
        <component :is="icon[chip.group]" class="size-3.5" aria-hidden="true" />
        {{ t(chip.label) }}
      </button>
    </div>
  </div>
</template>

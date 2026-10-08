<script setup lang="ts">
import {
  AudioLines,
  BookOpen,
  Box,
  Cloud,
  Columns2,
  Download,
  Image,
  LayoutGrid,
  Pencil,
  Video
} from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import type { Component } from 'vue'
import { computed, useTemplateRef } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ModelTabCounts } from '@/lib/workshop/explorer/model-tab-counts'
import { shownTabGroups } from '@/lib/workshop/explorer/model-tab-counts'
import type { ModelTab } from '@/lib/workshop/explorer/model-tabs'
import { modelTabLabelKey } from '@/lib/workshop/explorer/model-tabs'

const {
  panelId,
  counts,
  locale = 'en'
} = defineProps<{
  panelId: string
  counts: ModelTabCounts
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selected = defineModel<ModelTab>({ required: true })
const list = useTemplateRef<HTMLElement>('list')
const vertical = useMediaQuery('(width >= 64rem)')

const groups = computed(() => shownTabGroups(counts))
const tabs = computed(() => groups.value.flatMap((group) => group.tabs))

const icon: Record<ModelTab, Component> = {
  all: LayoutGrid,
  image: Image,
  video: Video,
  audio: AudioLines,
  '3d': Box,
  edit: Pencil,
  upscale: Columns2,
  llm: BookOpen,
  open: Download,
  partner: Cloud
}

function targetIndex(key: string, index: number, length: number) {
  switch (key) {
    case 'Home':
      return 0
    case 'End':
      return length - 1
    case vertical.value ? 'ArrowUp' : 'ArrowLeft':
      return (index - 1 + length) % length
    case vertical.value ? 'ArrowDown' : 'ArrowRight':
      return (index + 1) % length
    default:
      return undefined
  }
}

function onKeydown(event: KeyboardEvent) {
  const order = tabs.value
  const index = targetIndex(
    event.key,
    order.indexOf(selected.value),
    order.length
  )
  if (index === undefined) return
  event.preventDefault()
  const next = order[index]
  selected.value = next
  list.value?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus()
}
</script>

<template>
  <div
    class="-mx-1 mb-8 overflow-x-auto px-1 py-1 max-sm:mb-4 lg:sticky lg:top-26 lg:mx-0 lg:mb-0 lg:w-58 lg:shrink-0 lg:overflow-visible lg:px-0 lg:pt-4"
  >
    <div
      ref="list"
      role="tablist"
      :aria-label="t('workshop.explorer.tabs.label')"
      :aria-orientation="vertical ? 'vertical' : 'horizontal'"
      class="inline-flex items-center gap-0.5 rounded-full bg-hub-surface p-1 lg:flex lg:flex-col lg:items-stretch lg:gap-6 lg:rounded-none lg:bg-transparent lg:p-0"
      data-testid="model-tabs"
      @keydown="onKeydown"
    >
      <div
        v-for="(group, index) in groups"
        :key="group.titleKey"
        role="none"
        class="contents lg:flex lg:flex-col lg:gap-0.5"
      >
        <span
          v-if="index > 0"
          aria-hidden="true"
          class="px-3 pb-2 text-xs font-bold tracking-wider text-primary-warm-gray uppercase max-lg:hidden"
        >
          {{ t(group.titleKey) }}
        </span>
        <button
          v-for="tab in group.tabs"
          :id="`${panelId}-${tab}`"
          :key="tab"
          type="button"
          role="tab"
          :aria-controls="panelId"
          :data-tab="tab"
          :aria-selected="tab === selected"
          :tabindex="tab === selected ? 0 : -1"
          :class="
            cn(
              'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t4 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 lg:w-full lg:gap-2.5 lg:rounded-xl lg:text-sm',
              tab === selected &&
                'bg-transparency-white-t8 font-semibold text-primary-warm-white hover:bg-transparency-white-t8'
            )
          "
          @click="selected = tab"
        >
          <component
            :is="icon[tab]"
            :class="
              cn(
                'size-3.5 shrink-0 lg:size-4',
                tab === selected && 'text-primary-comfy-yellow'
              )
            "
            aria-hidden="true"
          />
          <span class="lg:min-w-0 lg:flex-1 lg:truncate lg:text-left">
            {{ t(modelTabLabelKey[tab]) }}
          </span>
          <span
            aria-hidden="true"
            :class="
              cn(
                'text-[13px] font-medium text-primary-warm-gray tabular-nums',
                tab === selected && 'lg:text-primary-comfy-canvas'
              )
            "
          >
            {{ counts.get(tab) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

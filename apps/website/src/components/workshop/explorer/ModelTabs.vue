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
import type { Component } from 'vue'
import { useTemplateRef } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ModelTab } from '@/lib/workshop/explorer/model-tabs'
import {
  MODEL_TABS,
  modelTabLabelKey
} from '@/lib/workshop/explorer/model-tabs'

const { panelId, locale = 'en' } = defineProps<{
  panelId: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selected = defineModel<ModelTab>({ required: true })
const list = useTemplateRef<HTMLElement>('list')

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

function focusTab(step: number) {
  const index = MODEL_TABS.indexOf(selected.value)
  const next =
    MODEL_TABS[(index + step + MODEL_TABS.length) % MODEL_TABS.length]
  selected.value = next
  list.value?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus()
}
</script>

<template>
  <div class="-mx-1 mb-8 overflow-x-auto px-1 py-1 max-sm:mb-4">
    <div
      ref="list"
      role="tablist"
      :aria-label="t('workshop.explorer.tabs.label')"
      class="inline-flex items-center gap-1 rounded-full bg-transparency-white-t4 p-1 ring-1 ring-transparency-white-t20"
      data-testid="model-tabs"
    >
      <button
        v-for="tab in MODEL_TABS"
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
            'inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
            tab === selected
              ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
              : 'text-primary-comfy-canvas hover:bg-transparency-white-t8 hover:text-primary-warm-white'
          )
        "
        @click="selected = tab"
        @keydown.right.prevent="focusTab(1)"
        @keydown.left.prevent="focusTab(-1)"
      >
        <component :is="icon[tab]" class="size-4" aria-hidden="true" />
        {{ t(modelTabLabelKey[tab]) }}
      </button>
    </div>
  </div>
</template>

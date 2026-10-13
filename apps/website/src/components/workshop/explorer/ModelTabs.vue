<script setup lang="ts">
import {
  AudioLines,
  BookOpen,
  Box,
  Columns2,
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
import {
  SIDEBAR_COUNT,
  SIDEBAR_FRAME,
  SIDEBAR_ICON,
  SIDEBAR_LABEL,
  SIDEBAR_LIST,
  SIDEBAR_TAB,
  SIDEBAR_TAB_SELECTED,
  sidebarTargetIndex
} from '@/lib/workshop/sidebar-tab-classes'

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
  llm: BookOpen
}

function onKeydown(event: KeyboardEvent) {
  const order = tabs.value
  const index = sidebarTargetIndex(
    event.key,
    order.indexOf(selected.value),
    order.length,
    vertical.value
  )
  if (index === undefined) return
  event.preventDefault()
  const next = order[index]
  selected.value = next
  list.value?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus()
}
</script>

<template>
  <div :class="SIDEBAR_FRAME">
    <div
      ref="list"
      role="tablist"
      :aria-label="t('workshop.explorer.tabs.label')"
      :aria-orientation="vertical ? 'vertical' : 'horizontal'"
      :class="SIDEBAR_LIST"
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
          :class="cn(SIDEBAR_TAB, tab === selected && SIDEBAR_TAB_SELECTED)"
          @click="selected = tab"
        >
          <component :is="icon[tab]" :class="SIDEBAR_ICON" aria-hidden="true" />
          <span :class="SIDEBAR_LABEL">
            {{ t(modelTabLabelKey[tab]) }}
          </span>
          <span
            aria-hidden="true"
            :class="
              cn(
                SIDEBAR_COUNT,
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

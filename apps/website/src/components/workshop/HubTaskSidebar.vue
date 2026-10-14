<script setup lang="ts">
import {
  AudioLines,
  Columns2,
  Film,
  Image,
  LayoutGrid,
  Pencil,
  Scissors,
  Video
} from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import type { Component } from 'vue'
import { computed, useTemplateRef } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { HubTaskEntry, HubTaskKey } from '@/lib/workshop/hub-tasks'
import { hubTaskLabelKey } from '@/lib/workshop/hub-tasks'
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
  entries,
  total,
  panelId,
  locale = 'en'
} = defineProps<{
  entries: readonly HubTaskEntry[]
  /** Everything listed under All. */
  total: number
  panelId: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selected = defineModel<HubTaskKey>({ required: true })
const list = useTemplateRef<HTMLElement>('list')
const vertical = useMediaQuery('(width >= 64rem)')

const icon: Record<HubTaskKey, Component> = {
  all: LayoutGrid,
  'generate-images': Image,
  'edit-images': Pencil,
  'generate-videos': Video,
  'animate-images': Film,
  'edit-videos': Scissors,
  upscale: Columns2,
  audio: AudioLines
}

const tabs = computed(() => [{ key: 'all' as const, count: total }, ...entries])

function onKeydown(event: KeyboardEvent) {
  const order = tabs.value.map((tab) => tab.key)
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
      :aria-label="t('workshop.taskSidebar.label')"
      :aria-orientation="vertical ? 'vertical' : 'horizontal'"
      :class="SIDEBAR_LIST"
      data-testid="hub-task-sidebar"
      @keydown="onKeydown"
    >
      <div role="none" class="contents lg:flex lg:flex-col lg:gap-0.5">
        <button
          v-for="tab in tabs"
          :id="`${panelId}-${tab.key}`"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-controls="panelId"
          :data-tab="tab.key"
          :data-testid="`hub-task-${tab.key}`"
          :aria-selected="tab.key === selected"
          :tabindex="tab.key === selected ? 0 : -1"
          :class="cn(SIDEBAR_TAB, tab.key === selected && SIDEBAR_TAB_SELECTED)"
          @click="selected = tab.key"
        >
          <component
            :is="icon[tab.key]"
            :class="SIDEBAR_ICON"
            aria-hidden="true"
          />
          <span :class="SIDEBAR_LABEL">{{ t(hubTaskLabelKey[tab.key]) }}</span>
          <span
            aria-hidden="true"
            :class="
              cn(
                SIDEBAR_COUNT,
                tab.key === selected && 'lg:text-primary-comfy-canvas'
              )
            "
          >
            {{ tab.count }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

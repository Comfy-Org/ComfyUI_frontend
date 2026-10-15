<script setup lang="ts" generic="K extends string">
import { useMediaQuery } from '@vueuse/core'
import { useTemplateRef } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { SidebarChoice } from '@/lib/workshop/sidebar-tab-classes'
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

const { entries, label, panelId } = defineProps<{
  /** The rows in order, All included. */
  entries: readonly SidebarChoice<K>[]
  label: string
  panelId: string
}>()

const selected = defineModel<K>({ required: true })
const list = useTemplateRef<HTMLElement>('list')
const vertical = useMediaQuery('(width >= 64rem)')

function onKeydown(event: KeyboardEvent) {
  const order = entries.map((entry) => entry.key)
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
      :aria-label="label"
      :aria-orientation="vertical ? 'vertical' : 'horizontal'"
      :class="SIDEBAR_LIST"
      data-testid="hub-choice-sidebar"
      @keydown="onKeydown"
    >
      <div role="none" class="contents lg:flex lg:flex-col lg:gap-0.5">
        <button
          v-for="entry in entries"
          :id="`${panelId}-${entry.key}`"
          :key="entry.key"
          type="button"
          role="tab"
          :aria-controls="panelId"
          :data-tab="entry.key"
          :aria-selected="entry.key === selected"
          :tabindex="entry.key === selected ? 0 : -1"
          :class="
            cn(SIDEBAR_TAB, entry.key === selected && SIDEBAR_TAB_SELECTED)
          "
          @click="selected = entry.key"
        >
          <component
            :is="entry.icon"
            v-if="entry.icon"
            :class="SIDEBAR_ICON"
            aria-hidden="true"
          />
          <span :class="SIDEBAR_LABEL">{{ entry.label }}</span>
          <span
            aria-hidden="true"
            :class="
              cn(
                SIDEBAR_COUNT,
                entry.key === selected && 'lg:text-primary-comfy-canvas'
              )
            "
          >
            {{ entry.count }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

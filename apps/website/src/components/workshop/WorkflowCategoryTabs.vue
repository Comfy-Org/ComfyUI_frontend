<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { WorkflowCategory } from '@/lib/workshop/workflow-categories'
import { ALL_WORKFLOWS } from '@/lib/workshop/workflow-categories'
import { workflowCategoryIcon } from '@/lib/workshop/workflow-category-icons'
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
  categories,
  total,
  panelId,
  locale = 'en'
} = defineProps<{
  categories: readonly WorkflowCategory[]
  /** Every workflow, listed under All. */
  total: number
  panelId: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selected = defineModel<string>({ required: true })
const list = useTemplateRef<HTMLElement>('list')
const vertical = useMediaQuery('(width >= 64rem)')

const tabs = computed(() => [
  { id: ALL_WORKFLOWS, label: t('workshop.explorer.tabs.all'), count: total },
  ...categories
])

function onKeydown(event: KeyboardEvent) {
  const order = tabs.value.map((tab) => tab.id)
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
      :aria-label="t('workshop.catalogue.categoriesLabel')"
      :aria-orientation="vertical ? 'vertical' : 'horizontal'"
      :class="SIDEBAR_LIST"
      data-testid="workflow-category-tabs"
      @keydown="onKeydown"
    >
      <div role="none" class="contents lg:flex lg:flex-col lg:gap-0.5">
        <button
          v-for="tab in tabs"
          :id="`${panelId}-${tab.id}`"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-controls="panelId"
          :data-tab="tab.id"
          :data-testid="`workflow-category-${tab.id}`"
          :aria-selected="tab.id === selected"
          :tabindex="tab.id === selected ? 0 : -1"
          :class="cn(SIDEBAR_TAB, tab.id === selected && SIDEBAR_TAB_SELECTED)"
          @click="selected = tab.id"
        >
          <component
            :is="workflowCategoryIcon(tab.id)"
            :class="SIDEBAR_ICON"
            aria-hidden="true"
          />
          <span :class="SIDEBAR_LABEL">{{ tab.label }}</span>
          <span
            aria-hidden="true"
            :class="
              cn(
                SIDEBAR_COUNT,
                tab.id === selected && 'lg:text-primary-comfy-canvas'
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

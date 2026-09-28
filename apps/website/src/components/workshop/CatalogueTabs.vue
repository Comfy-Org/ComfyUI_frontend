<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export type CatalogueTab = 'models' | 'workflows' | 'apps'

const {
  locale = 'en',
  focusActive = false,
  tabs = ['models', 'workflows', 'apps']
} = defineProps<{
  locale?: Locale
  focusActive?: boolean
  /** The home page teaches the same control with the halves it can open. */
  tabs?: readonly CatalogueTab[]
}>()
const emit = defineEmits<{ focused: [] }>()
const active = defineModel<CatalogueTab>({ required: true })
const labels = {
  models: 'workshop.hub.kind.models',
  workflows: 'workshop.hub.workflows',
  apps: 'workshop.catalogue.apps'
} as const
const buttons = useTemplateRef<HTMLButtonElement[]>('buttons')
onMounted(() => {
  if (!focusActive) return
  buttons.value?.[tabs.indexOf(active.value)]?.focus()
  emit('focused')
})
const marker = computed(
  () => `translateX(${tabs.indexOf(active.value) * 100}%)`
)
const columns = computed(() =>
  tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
)
</script>

<template>
  <div
    :class="
      cn(
        'relative grid w-fit shrink-0 rounded-2xl bg-transparency-white-t8 p-1',
        columns
      )
    "
    role="group"
    :aria-label="t('workshop.catalogue.show', locale)"
    data-testid="catalogue-tabs"
  >
    <div :class="cn('pointer-events-none absolute inset-1 grid', columns)">
      <div
        class="rounded-xl bg-primary-warm-white transition-transform duration-300 ease-out motion-reduce:transition-none"
        :style="{ transform: marker }"
      />
    </div>
    <button
      v-for="tab in tabs"
      ref="buttons"
      :key="tab"
      type="button"
      :aria-pressed="active === tab"
      :data-testid="`catalogue-tab-${tab}`"
      :class="
        cn(
          'relative inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-5 text-sm font-semibold whitespace-nowrap transition-colors duration-300 ease-out outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 motion-reduce:transition-none max-sm:px-3',
          active === tab
            ? 'text-page'
            : 'text-content-secondary hover:text-content-bright'
        )
      "
      @click="active = tab"
    >
      {{ t(labels[tab], locale) }}
    </button>
  </div>
</template>

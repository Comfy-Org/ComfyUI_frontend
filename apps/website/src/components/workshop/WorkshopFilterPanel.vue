<script setup lang="ts">
import { FocusScope } from 'reka-ui'
import type { ComponentProps } from 'vue-component-type-helpers'

import FacetSheet from './FacetSheet.vue'

type SheetProps = ComponentProps<typeof FacetSheet>
const { groups, labels, resultCount, isPhone, bottom } = defineProps<{
  groups: SheetProps['groups']
  labels: SheetProps['labels']
  resultCount: number
  isPhone: boolean
  bottom?: number
}>()
const emit = defineEmits<{
  toggle: [group: string, value: string]
  clearAll: []
  close: []
  restoreFocus: []
}>()
</script>

<template>
  <FocusScope
    as-child
    :trapped="isPhone"
    loop
    @unmount-auto-focus.prevent="emit('restoreFocus')"
  >
    <div
      role="dialog"
      :aria-label="labels.title"
      :aria-modal="isPhone || undefined"
      data-testid="workshop-filter-menu"
      :style="{ bottom: bottom !== undefined ? `${bottom}px` : undefined }"
      class="z-50 flex flex-col overflow-y-auto border border-white/10 bg-site-dropdown shadow-2xl shadow-black/50 outline-none max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-3xl sm:absolute sm:top-full sm:right-0 sm:mt-2 sm:max-h-[75vh] sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl"
      @keydown.escape.stop.prevent="emit('close')"
    >
      <FacetSheet
        :groups
        :labels
        :result-count
        @toggle="(group, value) => emit('toggle', group, value)"
        @clear-all="emit('clearAll')"
        @close="emit('close')"
      />
    </div>
  </FocusScope>
</template>

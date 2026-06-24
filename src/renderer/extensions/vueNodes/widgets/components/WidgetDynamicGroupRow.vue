<template>
  <div
    class="border-node-slot-background col-span-2 flex items-center justify-between border-t pt-1"
  >
    <span class="text-xs font-medium text-base-foreground/70">
      {{ rowLabel }}
    </span>
    <button
      v-if="widget.options?.removable"
      class="hover:text-danger rounded-sm p-0.5 text-base-foreground/50 transition-colors"
      :aria-label="t('dynamicGroup.removeRow')"
      @click="handleRemove"
    >
      <span
        class="icon-[material-symbols--close] size-3.5"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget } = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const { t } = useI18n()

const rowLabel = computed(() => {
  const match = /__row__(\d+)$/.exec(widget.name)
  const index = match ? Number(match[1]) : 0
  return t('dynamicGroup.row', { index: index + 1 })
})

function handleRemove() {
  widget.callback?.(widget.value)
}
</script>

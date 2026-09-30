<script setup lang="ts">
import { X } from '@lucide/vue'
import { nextTick } from 'vue'

import type { Locale } from '../../i18n/site'
import { t } from '../../i18n/site'

export interface FilterChip {
  key: string
  label: string
}

const { chips, locale = 'en' } = defineProps<{
  chips: readonly FilterChip[]
  locale?: Locale
}>()

const emit = defineEmits<{ remove: [string]; clear: []; emptied: [] }>()

// A removed chip takes its focused button with it, so focus moves to the chip
// that took its place, or back to the parent once none are left.
const removers = new Map<string, HTMLButtonElement>()
function track(key: string, element: unknown) {
  if (element instanceof HTMLButtonElement) removers.set(key, element)
  else removers.delete(key)
}

async function remove(index: number) {
  const neighbour = chips[index + 1] ?? chips[index - 1]
  emit('remove', chips[index].key)
  await nextTick()
  const next = neighbour && removers.get(neighbour.key)
  if (next) next.focus()
  else emit('emptied')
}

async function clear() {
  emit('clear')
  await nextTick()
  emit('emptied')
}
</script>

<template>
  <div
    v-if="chips.length"
    class="mb-6 flex flex-wrap items-center gap-2"
    data-testid="workshop-filter-chips"
  >
    <span
      v-for="(chip, index) in chips"
      :key="chip.key"
      class="inline-flex h-8 items-center gap-2 rounded-full bg-transparency-white-t8 px-3 text-xs text-content"
    >
      {{ chip.label }}
      <button
        :ref="(element) => track(chip.key, element)"
        type="button"
        class="-me-1 flex size-6 shrink-0 cursor-pointer items-center justify-center text-content-muted transition-colors outline-none hover:text-content-bright focus-visible:text-content-bright"
        :aria-label="
          t(
            'workshop.filter.remove',
            { filter: chip.label },
            { locale: locale }
          )
        "
        @click="remove(index)"
      >
        <X class="size-3" aria-hidden="true" />
      </button>
    </span>
    <button
      type="button"
      class="cursor-pointer px-1 py-1.5 text-xs text-content-muted underline underline-offset-4 transition-colors outline-none hover:text-content-bright focus-visible:text-content-bright"
      data-testid="workshop-filter-chips-clear"
      @click="clear"
    >
      {{ t('workshop.filter.clear', {}, { locale: locale }) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface FilterChip {
  key: string
  label: string
}

const { chips, locale = 'en' } = defineProps<{
  chips: readonly FilterChip[]
  locale?: Locale
}>()

const emit = defineEmits<{ remove: [string]; clear: [] }>()
</script>

<template>
  <div
    v-if="chips.length"
    class="mb-6 flex flex-wrap items-center gap-2"
    data-testid="workshop-filter-chips"
  >
    <span
      v-for="chip in chips"
      :key="chip.key"
      class="inline-flex h-8 items-center gap-2 rounded-full bg-transparency-white-t8 px-3 text-xs text-content"
    >
      {{ chip.label }}
      <button
        type="button"
        class="cursor-pointer text-content-muted transition-colors outline-none hover:text-content-bright focus-visible:text-content-bright"
        :aria-label="
          t('workshop.filter.remove', locale).replace('{filter}', chip.label)
        "
        @click="emit('remove', chip.key)"
      >
        <X class="size-3" aria-hidden="true" />
      </button>
    </span>
    <button
      type="button"
      class="cursor-pointer text-xs text-content-muted underline underline-offset-4 transition-colors outline-none hover:text-content-bright focus-visible:text-content-bright"
      data-testid="workshop-filter-chips-clear"
      @click="emit('clear')"
    >
      {{ t('workshop.filter.clear', locale) }}
    </button>
  </div>
</template>

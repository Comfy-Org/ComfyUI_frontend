<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import { translationsFor } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'
const { view, busy, locale } = defineProps<{
  view: 'DRAFT' | 'LIVE'
  busy: boolean
  locale: Locale
}>()
const emit = defineEmits<{ select: [view: 'DRAFT' | 'LIVE'] }>()
const t = computed(() => translationsFor(locale).t)
</script>
<template>
  <div
    role="group"
    :aria-label="t('cccPreview.view')"
    class="inline-flex gap-1 rounded-lg border border-admin-field p-0.5"
  >
    <button
      v-for="option in ['DRAFT', 'LIVE'] as const"
      :key="option"
      type="button"
      :aria-pressed="view === option"
      :disabled="busy"
      :class="
        cn(
          'inline-flex h-6.5 cursor-pointer items-center rounded-md px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40',
          view === option
            ? 'bg-admin-selected'
            : 'text-admin-muted hover:text-admin-fg'
        )
      "
      @click="emit('select', option)"
    >
      {{ t(option === 'DRAFT' ? 'cccPreview.draft' : 'cccPreview.live') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { Download, RotateCcw } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** What can be done with a finished take: reuse its settings, or keep the file. */
const {
  url,
  fileName,
  locale = 'en'
} = defineProps<{
  url: string
  fileName: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ reuse: [] }>()

const actionClass =
  'flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-primary-warm-white ring-1 ring-transparency-white-t20 transition-colors ring-inset hover:bg-transparency-white-t8'
</script>

<template>
  <div class="flex items-center gap-2">
    <button type="button" :class="actionClass" @click="emit('reuse')">
      <RotateCcw class="size-3.5" aria-hidden="true" />
      {{ t('openjutsu.take.reuse') }}
    </button>
    <a
      :href="url"
      :download="fileName"
      :class="actionClass"
      data-testid="openjutsu-download"
    >
      <Download class="size-3.5" aria-hidden="true" />
      {{ t('reshoot.download') }}
    </a>
  </div>
</template>

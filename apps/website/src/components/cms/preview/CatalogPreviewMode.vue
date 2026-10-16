<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { view, now, count, locale } = defineProps<{
  view: 'DRAFT' | 'LIVE'
  now?: string
  count?: number
  locale: Locale
}>()
const draft = computed(() => view === 'DRAFT')
const t = computed(() => translationsFor(locale).t)
</script>
<template>
  <p class="mr-auto flex items-center gap-2.5 text-sm">
    <span
      :class="
        cn(
          'inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold tracking-[0.04em] uppercase',
          draft
            ? 'border-admin-info/40 bg-admin-info/15 text-admin-info'
            : 'border-admin-success/40 bg-admin-success/15 text-admin-success'
        )
      "
    >
      <span class="relative flex size-2" aria-hidden="true">
        <span
          v-if="draft"
          class="absolute inline-flex size-full animate-ping rounded-full bg-admin-info opacity-60 motion-reduce:hidden"
        />
        <span
          :class="
            cn(
              'relative inline-flex size-2 rounded-full',
              draft ? 'bg-admin-info' : 'bg-admin-success'
            )
          "
        />
      </span>
      {{ t(draft ? 'cmsAdmin.preview.mode' : 'cmsAdmin.preview.liveMode') }}
    </span>
    <span class="hidden text-xs text-admin-muted sm:inline">
      <template v-if="view === 'DRAFT' && count !== undefined">
        {{ t('cccPreview.summary', { count }, { plural: count }) }}
      </template>
      <template v-if="now">
        <template v-if="view === 'DRAFT' && count !== undefined"> · </template>
        {{ t('cccPreview.timeTravel') }}
      </template>
    </span>
  </p>
</template>

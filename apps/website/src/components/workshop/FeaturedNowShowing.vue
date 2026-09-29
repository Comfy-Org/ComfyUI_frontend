<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  title,
  kind,
  locale = 'en'
} = defineProps<{
  title: string
  kind: string
  locale?: Locale
}>()
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex min-w-0 flex-col justify-end sm:relative sm:inset-auto sm:flex-1"
  >
    <div
      class="flex min-w-0 items-center gap-4 border-t border-transparency-white-t8 bg-page/70 px-6 py-3 backdrop-blur-md"
      data-testid="featured-now-showing"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          class="text-3xs font-bold tracking-widest text-primary-comfy-yellow uppercase"
        >
          {{ t('workshop.hub.nowShowing', locale) }}
        </span>
        <span class="truncate font-semibold text-primary-warm-white">
          {{ title }} · {{ kind }}
        </span>
      </div>
      <slot />
    </div>
  </div>
</template>

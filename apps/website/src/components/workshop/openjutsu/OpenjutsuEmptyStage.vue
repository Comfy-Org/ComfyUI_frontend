<script setup lang="ts">
import { Sparkles } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <div
    class="mx-auto flex aspect-video w-[min(100%,calc(48svh*16/9))] flex-col items-center justify-center gap-2 rounded-md bg-transparency-white-t4 px-6 text-center ring-1 ring-transparency-white-t8"
    data-testid="openjutsu-empty"
  >
    <Sparkles class="size-8 text-primary-warm-gray" aria-hidden="true" />
    <p class="text-base text-primary-comfy-canvas">
      {{ t('openjutsu.empty.title') }}
    </p>
    <p class="text-xs text-primary-warm-gray">
      {{ t('openjutsu.empty.hint') }}
    </p>
  </div>
</template>

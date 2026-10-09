<script setup lang="ts">
import { Film } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import OpenjutsuVideoInput from './OpenjutsuVideoInput.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ video: [file: File] }>()
</script>

<template>
  <OpenjutsuVideoInput
    class="flex w-full max-w-120 flex-col items-center gap-5 self-center rounded-2xl border border-dashed border-transparency-white-t20 bg-primary-comfy-ink/70 px-6 py-8 text-center backdrop-blur-sm sm:px-10"
    :label="t('openjutsu.video.drop')"
    data-testid="openjutsu-empty"
    @file="emit('video', $event)"
  >
    <span
      class="flex size-11 items-center justify-center rounded-xl bg-transparency-white-t8 text-primary-warm-white"
    >
      <Film class="size-5" aria-hidden="true" />
    </span>
    <span class="flex flex-col gap-1">
      <span class="text-base font-medium text-primary-warm-white">
        {{ t('openjutsu.empty.title') }}
      </span>
      <span class="text-xs/relaxed text-primary-warm-gray">
        {{ t('openjutsu.empty.hint') }}
      </span>
    </span>
    <span
      class="flex h-9 items-center rounded-full bg-primary-warm-white px-4 text-xs font-semibold text-primary-comfy-ink"
    >
      {{ t('openjutsu.video.drop') }}
    </span>
  </OpenjutsuVideoInput>
</template>

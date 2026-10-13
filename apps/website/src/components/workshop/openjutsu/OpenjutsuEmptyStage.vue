<script setup lang="ts">
import { Upload } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import OpenjutsuVideoInput from './OpenjutsuVideoInput.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ video: [file: File] }>()
</script>

<template>
  <section
    class="my-auto flex w-full max-w-3xl flex-col gap-6 self-center rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink-light/80 p-6 backdrop-blur-sm sm:flex-row sm:items-end sm:justify-between sm:p-9"
    data-testid="openjutsu-empty"
  >
    <div class="flex flex-col gap-1.5">
      <h2 class="text-xl font-medium text-primary-warm-white">
        {{ t('openjutsu.empty.title') }}
      </h2>
      <p class="text-sm text-primary-warm-gray">
        {{ t('openjutsu.empty.hint') }}
      </p>
    </div>
    <OpenjutsuVideoInput
      class="flex h-10 shrink-0 items-center gap-2 self-start rounded-full bg-primary-warm-white pr-4.5 pl-3.5 text-sm font-medium text-primary-comfy-ink sm:self-auto"
      @file="emit('video', $event)"
    >
      <Upload class="size-4" aria-hidden="true" />
      {{ t('openjutsu.video.add') }}
    </OpenjutsuVideoInput>
  </section>
</template>

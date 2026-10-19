<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>
<template>
  <div
    class="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 sm:gap-8 sm:p-10"
  >
    <p class="font-mono text-sm text-primary-comfy-yellow">
      ✓ {{ t('cli.session.filesSaved') }}
    </p>
    <div class="grid w-full max-w-3xl grid-cols-2 gap-4 sm:gap-8">
      <figure
        v-for="output in [
          {
            src: 'cat.png',
            name: 'cat.png',
            alt: t('cli.session.catAlt')
          },
          {
            src: 'lighthouse.png',
            name: 'f5308bc5_000.png',
            alt: t('cli.session.lighthouseAlt')
          }
        ]"
        :key="output.src"
        class="min-w-0"
      >
        <img
          :src="`/images/cli/session/${output.src}`"
          :alt="output.alt"
          width="400"
          height="400"
          loading="eager"
          decoding="async"
          class="aspect-square w-full rounded-2xl object-cover sm:rounded-3xl"
        />
        <figcaption
          class="mt-4 text-center font-mono text-xs text-primary-comfy-canvas sm:text-sm"
        >
          {{ output.name }}
        </figcaption>
      </figure>
    </div>
  </div>
</template>

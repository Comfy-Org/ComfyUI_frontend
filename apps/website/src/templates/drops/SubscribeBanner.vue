<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// V1 fallback: point at the Comfy YouTube channel until content team supplies
// a dedicated event-registration URL (Google Form, Eventbrite, etc.).
const signUpHref = externalLinks.youtube
</script>

<template>
  <div
    class="bg-primary-comfy-plum text-primary-warm-white flex w-full flex-col items-center justify-center gap-2 px-6 py-3 text-center text-sm sm:flex-row sm:gap-4"
  >
    <p>{{ t('drops.banner.text', locale) }}</p>
    <a
      :href="signUpHref"
      target="_blank"
      rel="noopener noreferrer"
      class="font-semibold uppercase underline underline-offset-4 hover:no-underline"
    >
      {{ t('drops.banner.cta', locale) }}
    </a>
  </div>
</template>

<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="border-y border-primary-comfy-canvas/10 px-6 py-10 text-center md:py-12"
    data-testid="affiliate-trust-band"
  >
    <p
      class="text-sm tracking-wider text-primary-comfy-canvas uppercase md:text-base"
    >
      {{ t('affiliate-landing.trust.label', locale) }}
    </p>
  </section>
</template>

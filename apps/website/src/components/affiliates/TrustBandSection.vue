<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="border-primary-comfy-canvas/10 border-y px-6 py-10 text-center md:py-12"
    data-testid="affiliate-trust-band"
  >
    <p
      class="text-primary-comfy-canvas text-sm tracking-wider uppercase md:text-base"
    >
      {{ t('affiliate-landing.trust.label', locale) }}
    </p>
  </section>
</template>

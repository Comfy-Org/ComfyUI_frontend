<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ClosingCtaSection from '../../templates/platform/ClosingCtaSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <ClosingCtaSection
    :locale="locale"
    visual="columns"
    badge-only
    :subtitle="t('home.platform.body', locale)"
  />
</template>

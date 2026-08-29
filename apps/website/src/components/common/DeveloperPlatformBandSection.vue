<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import CtaBands01 from '../blocks/CtaBands01.vue'
import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const bands = computed(() => [
  {
    id: 'developer-platform',
    label: t('enterprise.platformBand.label', locale),
    text: t('enterprise.platformBand.text', locale),
    cta: {
      label: t('enterprise.platformBand.cta', locale),
      href: getRoutes(locale).platform
    }
  }
])
</script>

<template>
  <CtaBands01 :bands="bands" />
</template>

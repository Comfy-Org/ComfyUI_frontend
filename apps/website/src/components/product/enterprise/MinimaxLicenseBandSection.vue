<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../../i18n/translations'

import CtaBands01 from '../../blocks/CtaBands01.vue'
import { getRoutes } from '../../../config/routes'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const bands = computed(() => [
  {
    id: 'minimax-license',
    label: t('enterprise.minimaxBand.label', locale),
    text: t('enterprise.minimaxBand.text', locale),
    cta: {
      label: t('enterprise.minimaxBand.cta', locale),
      href: getRoutes(locale).minimaxLicense
    }
  }
])
</script>

<template>
  <CtaBands01 :bands="bands" />
</template>

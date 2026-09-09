<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import CtaBands01 from '../../components/blocks/CtaBands01.vue'
import { localizeHref } from '../../config/routes'
import { fdctPage } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const bands = [
  {
    id: 'enterprise',
    label: t('fdct.bands.enterprise.label', locale),
    text: t('fdct.bands.enterprise.text', locale),
    cta: {
      label: t('fdct.bands.enterprise.cta', locale),
      href: localizeHref(fdctPage.ctas.enterpriseBand, locale)
    }
  },
  {
    id: 'minimax-license',
    label: t('fdct.bands.minimax.label', locale),
    text: t('fdct.bands.minimax.text', locale),
    cta: {
      label: t('fdct.bands.minimax.cta', locale),
      href: localizeHref(fdctPage.ctas.minimaxBand, locale)
    }
  }
]
</script>

<template>
  <CtaBands01 :bands="bands" />
</template>

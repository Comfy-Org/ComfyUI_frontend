<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import CtaBands01 from '../../components/blocks/CtaBands01.vue'
import { localizeHref } from '../../config/routes'
import { fdctPage } from '../../data/fdct'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const bands = [
  {
    id: 'enterprise',
    label: t('fdct.bands.enterprise.label'),
    text: t('fdct.bands.enterprise.text'),
    cta: {
      label: t('fdct.bands.enterprise.cta'),
      href: localizeHref(fdctPage.ctas.enterpriseBand, locale)
    }
  },
  {
    id: 'minimax-license',
    label: t('fdct.bands.minimax.label'),
    text: t('fdct.bands.minimax.text'),
    cta: {
      label: t('fdct.bands.minimax.cta'),
      href: localizeHref(fdctPage.ctas.minimaxBand, locale)
    }
  }
]
</script>

<template>
  <CtaBands01 :bands="bands" />
</template>

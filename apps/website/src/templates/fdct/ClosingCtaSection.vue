<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import { localizeHref } from '../../config/routes'
import { fdctPage } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <CtaCenter01
    :heading="t('fdct.closing.title', locale)"
    :primary-cta="{
      label: t('fdct.hero.contactCta', locale),
      href: localizeHref(fdctPage.ctas.contact, locale)
    }"
    :secondary-cta="{
      label: t('fdct.hero.applyCta', locale),
      href: fdctPage.ctas.applyFdct,
      target: '_blank'
    }"
  />
</template>

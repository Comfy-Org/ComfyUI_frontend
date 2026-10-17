<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import CtaCenter01 from '@/components/blocks/CtaCenter01.vue'
import { localizeHref } from '@/config/routes'
import { fdctPage } from '@/data/fdct'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <CtaCenter01
    :heading="t('fdct.closing.title')"
    :primary-cta="{
      label: t('fdct.hero.contactCta'),
      href: localizeHref(fdctPage.ctas.contact, locale)
    }"
  />
</template>

<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import CtaCenter01 from '@/components/blocks/CtaCenter01.vue'
import { localizeHref } from '@/config/routes'
import { vfxPage } from '@/data/vfx'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <CtaCenter01
    :heading="t('vfx.closing.title')"
    :subtitle="t('vfx.closing.subtitle')"
    :primary-cta="{
      label: t('vfx.closing.cta'),
      href: localizeHref(vfxPage.contactHref, locale)
    }"
  />
</template>

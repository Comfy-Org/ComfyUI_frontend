<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import OfferGrid01 from '@/components/blocks/OfferGrid01.vue'
import { vfxTasks } from '@/data/vfx'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <OfferGrid01
    :eyebrow="t('vfx.tasks.eyebrow')"
    :heading="t('vfx.tasks.heading')"
    :description="t('vfx.tasks.description')"
    :offers="vfxTasks(locale)"
  />
</template>

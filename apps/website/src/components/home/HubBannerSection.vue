<script setup lang="ts">
import WorkshopGate from '@/components/workshop/WorkshopGate.vue'
import type { HubBannerContent } from '@/data/hubBanner'
import type { Locale } from '@/i18n/translations'
import HubEntriesBanner from './HubEntriesBanner.vue'

const { locale = 'en', content } = defineProps<{
  locale?: Locale
  content: HubBannerContent
}>()
</script>

<template>
  <WorkshopGate>
    <HubEntriesBanner :locale :content />
  </WorkshopGate>
</template>

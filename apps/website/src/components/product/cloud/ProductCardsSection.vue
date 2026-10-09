<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import ProductCardsSection from '@/components/common/ProductCardsSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <ProductCardsSection :locale="locale" exclude-product="cloud" />
</template>

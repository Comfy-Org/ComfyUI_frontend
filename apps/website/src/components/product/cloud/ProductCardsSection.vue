<script setup lang="ts">
import type { Locale } from '../../../i18n/site'

import ProductCardsSection from '../../common/ProductCardsSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <ProductCardsSection :locale="locale" exclude-product="cloud" />
</template>

<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import ProductCardsSection from '../../common/ProductCardsSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <ProductCardsSection
    :locale="locale"
    exclude-product="local"
    label-key="products.labelProducts"
  />
</template>

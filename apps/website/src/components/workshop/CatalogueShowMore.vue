<script setup lang="ts">
import BrandButton from '@/components/common/BrandButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

defineEmits<{ more: [] }>()
</script>

<template>
  <div class="mt-10 flex justify-center max-sm:mt-8">
    <BrandButton
      type="button"
      variant="outline"
      size="nav"
      class="uppercase"
      data-testid="catalogue-show-more"
      @click="$emit('more')"
    >
      {{ t('workshop.hub.loadMore') }}
    </BrandButton>
  </div>
</template>

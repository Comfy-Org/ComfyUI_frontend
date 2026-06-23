<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import Button from '@/components/ui/button/Button.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const signUpHref = 'https://luma.com/l7c5z4gp'
</script>

<template>
  <div class="px-4">
    <div
      class="bg-primary-comfy-plum max-w-8xl rounded-5xl text-primary-warm-white mx-auto flex w-full flex-col items-center justify-center gap-2 px-6 py-5 text-center text-sm sm:flex-row sm:gap-4"
    >
      <p class="ppformula-text-center">{{ t('drops.banner.text', locale) }}</p>
      <Button
        :href="signUpHref"
        as="a"
        variant="link"
        size="sm"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t('drops.banner.cta', locale) }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="mx-auto max-w-4xl px-6 py-10 text-center lg:py-14">
    <p class="text-sm text-primary-comfy-canvas/70">
      {{ t('platform.router.proof.caption', locale) }}
    </p>
  </section>
</template>

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
    <p
      class="mt-6 text-lg font-medium tracking-tight text-primary-comfy-canvas md:text-xl"
    >
      {{ t('platform.router.proof.modelMakers', locale) }}
    </p>
    <p class="mt-3 text-xs text-primary-comfy-canvas/50">
      {{ t('platform.router.proof.comingSoon', locale) }}
    </p>
  </section>
</template>

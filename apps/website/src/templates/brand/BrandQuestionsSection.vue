<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import SectionHeader from '../../components/common/SectionHeader.vue'
import { getRoutes } from '../../config/routes.ts'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <section
    class="max-w-9xl mx-auto px-6 pt-10 pb-24 lg:px-20 lg:pt-12 lg:pb-32"
  >
    <SectionHeader align="start" max-width="xl">
      {{ t('brand.questions.heading', locale) }}
    </SectionHeader>

    <p class="text-primary-warm-gray mt-6 max-w-2xl text-sm leading-[1.6]">
      {{ t('brand.questions.body', locale) }}
      <a :href="routes.contact" class="text-primary-comfy-yellow underline">
        {{ t('brand.questions.contact', locale) }}
      </a>
    </p>
  </section>
</template>

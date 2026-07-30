<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import SectionHeader from '../../components/common/SectionHeader.vue'
import Button from '../../components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes.ts'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
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
      <Button
        as="a"
        variant="inline"
        :href="externalLinks.support"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t('brand.questions.contact', locale) }}
      </Button>
    </p>
  </section>
</template>

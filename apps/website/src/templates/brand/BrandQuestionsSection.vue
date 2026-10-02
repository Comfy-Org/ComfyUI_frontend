<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import SectionHeader from '../../components/common/SectionHeader.vue'
import Button from '../../components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes.ts'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <section
    class="mx-auto max-w-9xl px-6 pt-10 pb-24 lg:px-20 lg:pt-12 lg:pb-32"
  >
    <SectionHeader align="start" max-width="xl">
      {{ t('brand.questions.heading') }}
    </SectionHeader>

    <p class="mt-6 max-w-2xl text-sm/[1.6] text-primary-warm-gray">
      {{ t('brand.questions.body') }}
      <Button
        as="a"
        variant="inline"
        :href="externalLinks.support"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t('brand.questions.contact') }}
      </Button>
    </p>
  </section>
</template>

<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import Button from '../../components/ui/button/Button.vue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.builderEnterprise.heading', locale) }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700">
          {{ t('platform.builderEnterprise.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <Button as="a" :href="routes.enterpriseManagedBuilds" variant="outline">
        {{ t('enterprise.managedBuilds.explore', locale) }}
      </Button>
      <Button as="a" :href="routes.contact" variant="link">
        {{ t('enterprise.managedBuilds.talkToUs', locale) }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import Button from '../../ui/button/Button.vue'
import PlatformFeatureGrid from '../../../templates/platform/PlatformFeatureGrid.vue'
import { getRoutes } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const cardNumbers = [1, 3, 5] as const

const cards = cardNumbers.map((n) => ({
  title: t(`enterprise.managedBuilds.${n}.title`, locale),
  description:
    n === 3
      ? `${t('enterprise.managedBuilds.3.description', locale)}${t('enterprise.managedBuilds.3.linkLabel', locale)}${t('enterprise.managedBuilds.3.linkSuffix', locale)}`
      : t(`enterprise.managedBuilds.${n}.description`, locale)
}))
</script>

<template>
  <PlatformFeatureGrid
    id="managed-builds"
    :heading="t('enterprise.managedBuilds.heading', locale)"
    :subtitle="t('enterprise.managedBuilds.subtitle', locale)"
    :cards="cards"
  >
    <template #footer>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <Button as="a" :href="routes.enterpriseManagedBuilds" variant="outline">
          {{ t('enterprise.managedBuilds.explore', locale) }}
        </Button>
        <Button as="a" :href="routes.contact" variant="link">
          {{ t('enterprise.managedBuilds.talkToUs', locale) }}
        </Button>
      </div>
    </template>
  </PlatformFeatureGrid>
</template>

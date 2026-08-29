<script setup lang="ts">
import SectionHeader from '../../common/SectionHeader.vue'
import Button from '../../ui/button/Button.vue'
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
  <section
    id="managed-builds"
    class="max-w-9xl mx-auto scroll-mt-24 px-6 py-16 lg:scroll-mt-36 lg:py-24"
  >
    <SectionHeader max-width="xl">
      {{ t('enterprise.managedBuilds.heading', locale) }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700 lg:text-base">
          {{ t('enterprise.managedBuilds.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
      <article
        v-for="card in cards"
        :key="card.title"
        class="rounded-3xl border border-white/10 bg-transparency-white-t4 p-6 lg:p-8"
      >
        <h3 class="text-lg font-normal text-primary-warm-white">
          {{ card.title }}
        </h3>
        <p class="mt-3 text-sm/relaxed font-light text-primary-comfy-canvas">
          {{ card.description }}
        </p>
      </article>
    </div>

    <div class="mt-10 flex flex-wrap justify-center gap-3">
      <Button as="a" :href="routes.enterpriseManagedBuilds" variant="outline">
        {{ t('enterprise.managedBuilds.explore', locale) }}
      </Button>
      <Button as="a" :href="routes.contact" variant="link">
        {{ t('enterprise.managedBuilds.talkToUs', locale) }}
      </Button>
    </div>
  </section>
</template>

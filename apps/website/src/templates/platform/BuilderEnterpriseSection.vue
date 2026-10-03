<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import Button from '../../components/ui/button/Button.vue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const routes = getRoutes(locale)

const included = t('platform.builderEnterprise.included')
const notIncluded = t('platform.builderEnterprise.notIncluded')
const enterpriseOnly = t('platform.builderEnterprise.enterpriseOnly')

const features = [
  {
    label: t('platform.builderEnterprise.customNodes.label'),
    builder: included,
    managed: included
  },
  {
    label: t('platform.builderEnterprise.teamSharing.label'),
    builder: notIncluded,
    managed: enterpriseOnly
  },
  {
    label: t('platform.builderEnterprise.governance.label'),
    builder: notIncluded,
    managed: enterpriseOnly
  },
  {
    label: t('platform.builderEnterprise.pythonDependencies.label'),
    builder: included,
    managed: included
  }
]
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.builderEnterprise.heading') }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700">
          {{ t('platform.builderEnterprise.subtitle') }}
        </p>
      </template>
    </SectionHeader>

    <div
      class="mx-auto mt-8 max-w-5xl overflow-hidden rounded-4xl bg-transparency-white-t4 px-4 py-6 lg:px-8"
    >
      <div class="scrollbar-none overflow-x-auto">
        <table class="w-full min-w-150 text-left text-sm">
          <thead
            class="text-xs font-bold tracking-widest text-primary-comfy-yellow uppercase"
          >
            <tr>
              <th class="p-3">
                {{ t('platform.builderEnterprise.feature') }}
              </th>
              <th class="p-3">
                {{ t('platform.products.builder.title') }}
              </th>
              <th class="p-3">
                {{ t('enterprise.managedBuilds.heading') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/10 text-primary-comfy-canvas">
            <tr v-for="feature in features" :key="feature.label">
              <th class="px-3 py-4 font-normal">
                {{ feature.label }}
              </th>
              <td class="px-3 py-4 text-smoke-700">
                {{ feature.builder }}
              </td>
              <td class="px-3 py-4 text-smoke-700">
                {{ feature.managed }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mt-8 flex justify-center">
      <Button as="a" :href="routes.managedBuilds" variant="outline">
        {{ t('enterprise.managedBuilds.explore') }}
      </Button>
    </div>
  </section>
</template>

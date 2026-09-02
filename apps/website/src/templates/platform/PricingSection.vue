<script setup lang="ts">
import { Coins as CreditsIcon } from '@lucide/vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  locale = 'en',
  heading,
  subtitle,
  note
} = defineProps<{
  locale?: Locale
  heading?: string
  subtitle?: string
  note?: string
}>()

// Rates from the Limited Beta PRFAQ (USD and Comfy Credits).
const gpuRates = [
  {
    gpu: 'RTX PRO 6000',
    vram: '96 GB',
    price: '$3.49/hr',
    credits: '736.39/hr'
  },
  { gpu: 'H100', vram: '80 GB', price: '$4.79/hr', credits: '1010.69/hr' },
  { gpu: 'H200', vram: '141 GB', price: '$5.93/hr', credits: '1251.23/hr' },
  { gpu: 'B200', vram: '180 GB', price: '$8.64/hr', credits: '1823.04/hr' }
]

const storageRates = [
  {
    key: 'standardUnder1tb',
    price: '$0.091/GB/mo',
    credits: '19.20/GB/mo'
  },
  {
    key: 'standardOver1tb',
    price: '$0.065/GB/mo',
    credits: '13.72/GB/mo'
  },
  {
    key: 'highPerformance',
    price: '$0.182/GB/mo',
    credits: '38.40/GB/mo'
  },
  {
    key: 'containerDisk',
    price: '$0.13/GB/mo',
    credits: '27.43/GB/mo'
  }
] as const

const mobileGpuRows = gpuRates.map((rate) => ({
  ...rate,
  vramLabel: `${rate.vram} VRAM`,
  creditsLabel: rate.credits.replace('/hr', ' credits/hr')
}))

const mobileStorageRows = storageRates.map((rate) => ({
  ...rate,
  creditsLabel: `${rate.credits.replace('/GB/mo', '')} credits`
}))
</script>

<template>
  <section
    id="pricing"
    class="max-w-9xl mx-auto scroll-mt-24 px-6 py-10 lg:scroll-mt-36 lg:py-14"
  >
    <SectionHeader max-width="xl" heading-size="compact">
      {{ heading ?? t('platform.pricing.heading', locale) }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700">
          {{ subtitle ?? t('platform.pricing.subtitle', locale) }}
        </p>
        <p v-if="note" class="mt-2 text-xs text-smoke-700/80">
          {{ note }}
        </p>
      </template>
    </SectionHeader>

    <div class="mx-auto mt-8 flex max-w-6xl flex-col gap-4 lg:hidden">
      <article class="bg-transparency-white-t4 rounded-4xl px-5 py-6">
        <p
          class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
        >
          {{ t('platform.pricing.gpuColumn', locale) }}
        </p>
        <ul class="mt-5 space-y-5">
          <li
            v-for="rate in mobileGpuRows"
            :key="rate.gpu"
            class="flex items-start justify-between gap-4"
          >
            <div>
              <p class="text-sm text-primary-warm-white">{{ rate.gpu }}</p>
              <p class="mt-0.5 text-xs text-primary-warm-gray">
                {{ rate.vramLabel }}
              </p>
            </div>
            <div class="text-right font-mono">
              <p class="text-sm text-primary-warm-white">{{ rate.price }}</p>
              <p
                class="mt-0.5 flex items-center justify-end gap-1 text-xs text-primary-warm-gray"
              >
                <CreditsIcon
                  class="text-primary-comfy-yellow size-3.5 shrink-0"
                  aria-hidden="true"
                />
                {{ rate.creditsLabel }}
              </p>
            </div>
          </li>
        </ul>
        <p class="mt-6 text-xs text-primary-warm-gray">
          {{ t('platform.pricing.billedPerSecond', locale) }}
        </p>
      </article>

      <article class="bg-transparency-white-t4 rounded-4xl px-5 py-6">
        <p
          class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
        >
          {{ t('platform.pricing.storageColumn', locale) }}
        </p>
        <ul class="mt-5 space-y-5">
          <li
            v-for="rate in mobileStorageRows"
            :key="rate.key"
            class="flex items-start justify-between gap-4"
          >
            <div>
              <p class="text-sm text-primary-warm-white">
                {{
                  rate.key === 'containerDisk'
                    ? t('platform.pricing.storage.containerDisk', locale)
                    : t('platform.pricing.storage.networkTitle', locale)
                }}
              </p>
              <p class="mt-0.5 text-xs text-primary-warm-gray">
                {{ t(`platform.pricing.storage.sub.${rate.key}`, locale) }}
              </p>
            </div>
            <div class="shrink-0 text-right font-mono">
              <p class="text-sm text-primary-warm-white">{{ rate.price }}</p>
              <p
                class="mt-0.5 flex items-center justify-end gap-1 text-xs text-primary-warm-gray"
              >
                <CreditsIcon
                  class="text-primary-comfy-yellow size-3.5 shrink-0"
                  aria-hidden="true"
                />
                {{ rate.creditsLabel }}
              </p>
            </div>
          </li>
        </ul>
        <p class="mt-6 text-xs/relaxed text-primary-warm-gray">
          {{ t('platform.pricing.storageNote', locale) }}
        </p>
      </article>
    </div>

    <div
      class="bg-transparency-white-t4 mx-auto mt-8 hidden max-w-6xl overflow-hidden rounded-4xl px-4 py-6 lg:block lg:px-8"
    >
      <div class="grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <article class="flex min-w-0 flex-col">
          <div class="scrollbar-none overflow-x-auto">
            <table class="w-full min-w-130 text-left text-sm">
              <thead>
                <tr
                  class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
                >
                  <th class="px-2 py-4" scope="col">
                    {{ t('platform.pricing.gpuColumn', locale) }}
                  </th>
                  <th class="p-4" scope="col">
                    {{ t('platform.pricing.vramColumn', locale) }}
                  </th>
                  <th class="p-4 text-right" scope="col">
                    {{ t('platform.pricing.priceColumn', locale) }}
                  </th>
                  <th class="px-2 py-4 text-right" scope="col">
                    {{ t('platform.pricing.creditsColumn', locale) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rate in gpuRates" :key="rate.gpu">
                  <td class="px-2 py-3.5 text-sm text-primary-warm-white">
                    {{ rate.gpu }}
                  </td>
                  <td class="px-4 py-3.5 text-xs text-primary-warm-gray">
                    {{ rate.vram }}
                  </td>
                  <td
                    class="px-4 py-3.5 text-right font-mono text-sm text-primary-warm-white"
                  >
                    {{ rate.price }}
                  </td>
                  <td
                    class="px-2 py-3.5 text-right font-mono text-xs text-primary-warm-gray"
                  >
                    <span class="flex items-center justify-end gap-1">
                      <CreditsIcon
                        class="text-primary-comfy-yellow size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {{ rate.credits }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-auto px-2 pt-6 text-xs text-primary-warm-gray">
            {{ t('platform.pricing.billedPerSecond', locale) }}
          </p>
        </article>

        <article class="flex min-w-0 flex-col">
          <div class="scrollbar-none overflow-x-auto">
            <table class="w-full min-w-130 text-left text-sm">
              <thead>
                <tr
                  class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
                >
                  <th class="px-2 py-4" scope="col">
                    {{ t('platform.pricing.storageColumn', locale) }}
                  </th>
                  <th class="p-4 text-right" scope="col">
                    {{ t('platform.pricing.priceColumn', locale) }}
                  </th>
                  <th class="px-2 py-4 text-right" scope="col">
                    {{ t('platform.pricing.creditsColumn', locale) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rate in storageRates" :key="rate.key">
                  <td class="max-w-56 px-2 py-3.5">
                    <p class="text-sm text-primary-warm-white">
                      {{
                        rate.key === 'containerDisk'
                          ? t('platform.pricing.storage.containerDisk', locale)
                          : t('platform.pricing.storage.networkTitle', locale)
                      }}
                    </p>
                    <p class="mt-0.5 text-xs text-primary-warm-gray">
                      {{
                        t(`platform.pricing.storage.sub.${rate.key}`, locale)
                      }}
                    </p>
                  </td>
                  <td
                    class="px-4 py-3.5 text-right font-mono text-sm text-primary-warm-white"
                  >
                    {{ rate.price }}
                  </td>
                  <td
                    class="px-2 py-3.5 text-right font-mono text-xs text-primary-warm-gray"
                  >
                    <span class="flex items-center justify-end gap-1">
                      <CreditsIcon
                        class="text-primary-comfy-yellow size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {{ rate.credits }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-auto px-2 pt-6 text-xs/relaxed text-primary-warm-gray">
            {{ t('platform.pricing.storageNote', locale) }}
          </p>
        </article>
      </div>
    </div>

    <!-- Extra rate cards a page appends under the tables (/pricing adds the
         MiniMax license band); /platform leaves it empty. -->
    <slot />
  </section>
</template>

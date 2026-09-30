<script setup lang="ts">
import { Coins as CreditsIcon } from '@lucide/vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  formatCreditsPerGbMonth,
  formatCreditsPerHour,
  formatStorageExampleAmount,
  formatUsdPerGbMonth,
  formatUsdPerHour,
  getStorageRate,
  groupStorageRatesForDisplay,
  rateCard
} from '../../data/rateCard'

const {
  locale = 'en',
  heading,
  subtitle,
  note,
  headingSize = 'compact',
  bare = false
} = defineProps<{
  locale?: Locale
  heading?: string
  subtitle?: string
  note?: string
  headingSize?: 'compact' | 'subsection'
  /** Render the tables alone, with no section wrapper or heading — for embedding inside another section. */
  bare?: boolean
}>()

const gpuRates = rateCard.gpus.map((rate) => ({
  gpu: rate.label,
  vram: `${rate.vramGb} GB`,
  price: formatUsdPerHour(rate.pricePerHourUsd),
  credits: formatCreditsPerHour(rate.creditsPerHour)
}))

const storageRates = groupStorageRatesForDisplay(rateCard.storage)
  .filter((rate) => rate.key !== 'containerDisk')
  .map((rate) => ({
    key: rate.key,
    price: formatUsdPerGbMonth(rate.pricePerGbMonthUsd),
    credits: formatCreditsPerGbMonth(rate.creditsPerGbMonth),
    title: t('platform.pricing.storage.title', {}, { locale: locale })
  }))

const storageExampleAmount = formatStorageExampleAmount(
  getStorageRate('network_standard')
)

const rootTag = bare ? 'div' : 'section'
const rootId = bare ? undefined : 'pricing'
const rootClass = bare
  ? 'mx-auto max-w-9xl'
  : 'mx-auto max-w-9xl scroll-mt-24 px-6 py-10 lg:scroll-mt-36 lg:py-14'

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
  <component :is="rootTag" :id="rootId" :class="rootClass">
    <SectionHeader v-if="!bare" max-width="xl" :heading-size="headingSize">
      {{ heading ?? t('platform.pricing.heading', {}, { locale: locale }) }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700">
          {{
            subtitle ?? t('platform.pricing.subtitle', {}, { locale: locale })
          }}
        </p>
        <p v-if="note" class="mt-2 text-xs text-smoke-700/80">
          {{ note }}
        </p>
      </template>
    </SectionHeader>

    <div class="mx-auto mt-8 flex max-w-6xl flex-col gap-4 lg:hidden">
      <article class="rounded-4xl bg-transparency-white-t4 px-5 py-6">
        <p
          class="text-xs font-bold tracking-widest text-primary-comfy-yellow uppercase"
        >
          {{ t('platform.pricing.gpuColumn', {}, { locale: locale }) }}
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
                  class="size-3.5 shrink-0 text-primary-comfy-yellow"
                  aria-hidden="true"
                />
                {{ rate.creditsLabel }}
              </p>
            </div>
          </li>
        </ul>
        <p class="mt-6 text-xs text-primary-warm-gray">
          {{ t('platform.pricing.billedPerSecond', {}, { locale: locale }) }}
        </p>
      </article>

      <article class="rounded-4xl bg-transparency-white-t4 px-5 py-6">
        <p
          class="text-xs font-bold tracking-widest text-primary-comfy-yellow uppercase"
        >
          {{ t('platform.pricing.storageColumn', {}, { locale: locale }) }}
        </p>
        <ul class="mt-5 space-y-5">
          <li
            v-for="rate in mobileStorageRows"
            :key="rate.key"
            class="flex items-start justify-between gap-4"
          >
            <div>
              <p class="text-sm text-primary-warm-white">{{ rate.title }}</p>
            </div>
            <div class="shrink-0 text-right font-mono">
              <p class="text-sm text-primary-warm-white">{{ rate.price }}</p>
              <p
                class="mt-0.5 flex items-center justify-end gap-1 text-xs text-primary-warm-gray"
              >
                <CreditsIcon
                  class="size-3.5 shrink-0 text-primary-comfy-yellow"
                  aria-hidden="true"
                />
                {{ rate.creditsLabel }}
              </p>
            </div>
          </li>
        </ul>
        <p class="mt-6 text-xs/relaxed text-primary-warm-gray">
          {{ t('platform.pricing.storageNote', {}, { locale: locale }) }}
          {{
            t(
              'platform.pricing.storageExample',
              {
                amount: storageExampleAmount
              },
              { locale: locale }
            )
          }}
        </p>
      </article>
    </div>

    <div
      class="mx-auto mt-8 hidden max-w-6xl overflow-hidden rounded-4xl bg-transparency-white-t4 px-4 py-6 lg:block lg:px-8"
    >
      <div class="grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <article class="flex min-w-0 flex-col">
          <div class="scrollbar-none overflow-x-auto">
            <table class="w-full min-w-130 text-left text-sm">
              <thead>
                <tr
                  class="text-xs font-bold tracking-widest text-primary-comfy-yellow uppercase"
                >
                  <th class="px-2 py-4" scope="col">
                    {{
                      t('platform.pricing.gpuColumn', {}, { locale: locale })
                    }}
                  </th>
                  <th class="p-4" scope="col">
                    {{
                      t('platform.pricing.vramColumn', {}, { locale: locale })
                    }}
                  </th>
                  <th class="p-4 text-right" scope="col">
                    {{
                      t('platform.pricing.priceColumn', {}, { locale: locale })
                    }}
                  </th>
                  <th class="px-2 py-4 text-right" scope="col">
                    {{
                      t(
                        'platform.pricing.creditsColumn',
                        {},
                        { locale: locale }
                      )
                    }}
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
                        class="size-3.5 shrink-0 text-primary-comfy-yellow"
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
            {{ t('platform.pricing.billedPerSecond', {}, { locale: locale }) }}
          </p>
        </article>

        <article class="flex min-w-0 flex-col">
          <div class="scrollbar-none overflow-x-auto">
            <table class="w-full min-w-130 text-left text-sm">
              <thead>
                <tr
                  class="text-xs font-bold tracking-widest text-primary-comfy-yellow uppercase"
                >
                  <th class="px-2 py-4" scope="col">
                    {{
                      t(
                        'platform.pricing.storageColumn',
                        {},
                        { locale: locale }
                      )
                    }}
                  </th>
                  <th class="p-4 text-right" scope="col">
                    {{
                      t('platform.pricing.priceColumn', {}, { locale: locale })
                    }}
                  </th>
                  <th class="px-2 py-4 text-right" scope="col">
                    {{
                      t(
                        'platform.pricing.creditsColumn',
                        {},
                        { locale: locale }
                      )
                    }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rate in storageRates" :key="rate.key">
                  <td class="max-w-56 px-2 py-3.5">
                    <p class="text-sm text-primary-warm-white">
                      {{ rate.title }}
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
                        class="size-3.5 shrink-0 text-primary-comfy-yellow"
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
            {{ t('platform.pricing.storageNote', {}, { locale: locale }) }}
            {{
              t(
                'platform.pricing.storageExample',
                {
                  amount: storageExampleAmount
                },
                { locale: locale }
              )
            }}
          </p>
        </article>
      </div>
    </div>
  </component>
</template>

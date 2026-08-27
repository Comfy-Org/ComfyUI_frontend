<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Rates from the Limited Beta PRFAQ (USD and Comfy Credits).
const gpuRates = [
  { gpu: 'RTX 5090', vram: '32 GB', price: '$1.58/hr', credits: '333.38/hr' },
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
</script>

<template>
  <section
    id="pricing"
    class="max-w-9xl mx-auto scroll-mt-24 px-6 py-10 lg:scroll-mt-36 lg:py-14"
  >
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.pricing.heading', locale) }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700">
          {{ t('platform.pricing.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div
      class="mx-auto mt-8 grid max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-2"
    >
      <div class="overflow-hidden rounded-3xl border border-white/10">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="bg-white/4 text-xs tracking-wider uppercase">
              <th
                class="px-5 py-4 font-bold text-primary-comfy-canvas"
                scope="col"
              >
                {{ t('platform.pricing.gpuColumn', locale) }}
              </th>
              <th
                class="px-5 py-4 font-bold text-primary-comfy-canvas"
                scope="col"
              >
                {{ t('platform.pricing.vramColumn', locale) }}
              </th>
              <th
                class="px-5 py-4 text-right font-bold text-primary-comfy-canvas"
                scope="col"
              >
                {{ t('platform.pricing.priceColumn', locale) }}
              </th>
              <th
                class="px-5 py-4 text-right font-bold text-primary-comfy-canvas"
                scope="col"
              >
                {{ t('platform.pricing.creditsColumn', locale) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="rate in gpuRates"
              :key="rate.gpu"
              class="border-t border-white/10"
            >
              <td class="px-5 py-3.5 text-primary-warm-white">
                {{ rate.gpu }}
              </td>
              <td class="px-5 py-3.5 text-primary-comfy-canvas">
                {{ rate.vram }}
              </td>
              <td
                class="px-5 py-3.5 text-right font-mono text-primary-comfy-canvas"
              >
                {{ rate.price }}
              </td>
              <td class="px-5 py-3.5 text-right font-mono text-smoke-700">
                {{ rate.credits }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          class="border-t border-white/10 bg-white/4 px-5 py-3 text-xs text-smoke-700"
        >
          {{ t('platform.pricing.billedPerSecond', locale) }}
        </p>
      </div>

      <div class="overflow-hidden rounded-3xl border border-white/10">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="bg-white/4 text-xs tracking-wider uppercase">
              <th
                class="px-5 py-4 font-bold text-primary-comfy-canvas"
                scope="col"
              >
                {{ t('platform.pricing.storageColumn', locale) }}
              </th>
              <th
                class="px-5 py-4 text-right font-bold text-primary-comfy-canvas"
                scope="col"
              >
                {{ t('platform.pricing.priceColumn', locale) }}
              </th>
              <th
                class="px-5 py-4 text-right font-bold text-primary-comfy-canvas"
                scope="col"
              >
                {{ t('platform.pricing.creditsColumn', locale) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="rate in storageRates"
              :key="rate.key"
              class="border-t border-white/10"
            >
              <td class="px-5 py-3.5 text-primary-warm-white">
                {{ t(`platform.pricing.storage.${rate.key}`, locale) }}
              </td>
              <td
                class="px-5 py-3.5 text-right font-mono text-primary-comfy-canvas"
              >
                {{ rate.price }}
              </td>
              <td class="px-5 py-3.5 text-right font-mono text-smoke-700">
                {{ rate.credits }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          class="border-t border-white/10 bg-white/4 px-5 py-3 text-xs text-smoke-700"
        >
          {{ t('platform.pricing.storageNote', locale) }}
        </p>
      </div>
    </div>

    <div class="mx-auto mt-6 max-w-2xl space-y-2 text-center">
      <p class="text-xs text-primary-comfy-canvas">
        {{ t('platform.pricing.idleNote', locale) }}
      </p>
      <p class="text-xs text-primary-comfy-canvas">
        {{ t('platform.pricing.storageExample', locale) }}
      </p>
      <p class="text-xs text-smoke-700">
        {{ t('platform.pricing.routerNote', locale) }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en', flat = false } = defineProps<{
  locale?: Locale
  flat?: boolean
}>()

const headCell = flat ? 'px-6 py-4' : 'px-5 py-4'
const bodyCell = flat ? 'px-6 py-5' : 'px-5 py-3.5'

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
      :class="
        cn(
          'mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2',
          flat ? 'rounded-4xl border border-white/10 p-4 lg:p-6' : 'items-start'
        )
      "
    >
      <div
        :class="
          cn(
            'overflow-hidden rounded-3xl',
            flat ? 'h-full bg-[#2a2230]' : 'border border-white/10'
          )
        "
      >
        <table class="w-full text-left text-sm">
          <thead>
            <tr
              :class="
                cn(
                  'text-xs tracking-wider uppercase',
                  flat ? 'border-b border-white/10' : 'bg-white/4'
                )
              "
            >
              <th
                :class="cn(headCell, 'font-bold text-primary-comfy-canvas')"
                scope="col"
              >
                {{ t('platform.pricing.gpuColumn', locale) }}
              </th>
              <th
                :class="cn(headCell, 'font-bold text-primary-comfy-canvas')"
                scope="col"
              >
                {{ t('platform.pricing.vramColumn', locale) }}
              </th>
              <th
                :class="
                  cn(headCell, 'text-right font-bold text-primary-comfy-canvas')
                "
                scope="col"
              >
                {{ t('platform.pricing.priceColumn', locale) }}
              </th>
              <th
                :class="
                  cn(headCell, 'text-right font-bold text-primary-comfy-canvas')
                "
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
              :class="cn(!flat && 'border-t border-white/10')"
            >
              <td :class="cn(bodyCell, 'text-primary-warm-white')">
                {{ rate.gpu }}
              </td>
              <td :class="cn(bodyCell, 'text-primary-comfy-canvas')">
                {{ rate.vram }}
              </td>
              <td
                :class="
                  cn(bodyCell, 'text-right font-mono text-primary-comfy-canvas')
                "
              >
                {{ rate.price }}
              </td>
              <td :class="cn(bodyCell, 'text-right font-mono text-smoke-700')">
                {{ rate.credits }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          :class="
            cn(
              'text-xs text-smoke-700',
              flat
                ? 'px-6 pt-1 pb-6'
                : 'border-t border-white/10 bg-white/4 px-5 py-3'
            )
          "
        >
          {{ t('platform.pricing.billedPerSecond', locale) }}
        </p>
      </div>

      <div
        :class="
          cn(
            'overflow-hidden rounded-3xl',
            flat ? 'h-full bg-[#2a2230]' : 'border border-white/10'
          )
        "
      >
        <table class="w-full text-left text-sm">
          <thead>
            <tr
              :class="
                cn(
                  'text-xs tracking-wider uppercase',
                  flat ? 'border-b border-white/10' : 'bg-white/4'
                )
              "
            >
              <th
                :class="cn(headCell, 'font-bold text-primary-comfy-canvas')"
                scope="col"
              >
                {{ t('platform.pricing.storageColumn', locale) }}
              </th>
              <th
                :class="
                  cn(headCell, 'text-right font-bold text-primary-comfy-canvas')
                "
                scope="col"
              >
                {{ t('platform.pricing.priceColumn', locale) }}
              </th>
              <th
                :class="
                  cn(headCell, 'text-right font-bold text-primary-comfy-canvas')
                "
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
              :class="cn(!flat && 'border-t border-white/10')"
            >
              <td :class="cn(bodyCell, 'text-primary-warm-white')">
                {{ t(`platform.pricing.storage.${rate.key}`, locale) }}
              </td>
              <td
                :class="
                  cn(bodyCell, 'text-right font-mono text-primary-comfy-canvas')
                "
              >
                {{ rate.price }}
              </td>
              <td :class="cn(bodyCell, 'text-right font-mono text-smoke-700')">
                {{ rate.credits }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          :class="
            cn(
              'text-xs text-smoke-700',
              flat
                ? 'px-6 pt-1 pb-6'
                : 'border-t border-white/10 bg-white/4 px-5 py-3'
            )
          "
        >
          {{ t('platform.pricing.storageNote', locale) }}
        </p>
      </div>
    </div>

    <div
      :class="
        cn(
          'mx-auto mt-6 space-y-2',
          flat ? 'max-w-6xl text-left' : 'max-w-2xl text-center'
        )
      "
    >
      <p
        :class="
          cn(
            'text-xs',
            flat ? 'text-primary-warm-gray' : 'text-primary-comfy-canvas'
          )
        "
      >
        {{ t('platform.pricing.idleNote', locale) }}
      </p>
      <p
        :class="
          cn(
            'text-xs',
            flat ? 'text-primary-warm-gray' : 'text-primary-comfy-canvas'
          )
        "
      >
        {{ t('platform.pricing.storageExample', locale) }}
      </p>
      <p
        :class="
          cn('text-xs', flat ? 'text-primary-warm-gray' : 'text-smoke-700')
        "
      >
        {{ t('platform.pricing.modelsNote', locale) }}
      </p>
    </div>
  </section>
</template>

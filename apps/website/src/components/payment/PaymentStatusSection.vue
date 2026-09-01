<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import SectionLabel from '../common/SectionLabel.vue'

// Display-only thank-you / failure pages: payment state is verified
// server-side via Stripe webhooks (see comfy-api). These pages exist
// solely as the redirect target for Stripe Checkout.

type Status = 'success' | 'failed'

const { status, locale = 'en' } = defineProps<{
  status: Status
  locale?: Locale
}>()

const primaryHref =
  status === 'success' ? externalLinks.cloud : externalLinks.support
const secondaryHref =
  status === 'success'
    ? externalLinks.platformUsage
    : externalLinks.docsSubscription

const iconRingClass =
  status === 'success'
    ? 'border-primary-comfy-yellow text-primary-comfy-yellow'
    : 'border-secondary-mauve text-secondary-mauve'
</script>

<template>
  <section
    class="flex min-h-[calc(100dvh-12rem)] items-center justify-center px-6 py-16 lg:py-24"
  >
    <div class="flex max-w-2xl flex-col items-center gap-6 text-center">
      <div
        :class="
          cn(
            'flex size-20 items-center justify-center rounded-full border-2',
            iconRingClass
          )
        "
        aria-hidden="true"
      >
        <svg
          v-if="status === 'success'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-10"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-10"
        >
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      </div>

      <SectionLabel>{{ t(`payment.${status}.label`, locale) }}</SectionLabel>

      <h1
        class="text-primary-comfy-canvas text-4xl/tight font-light md:text-5xl/tight lg:text-6xl/tight"
      >
        {{ t(`payment.${status}.title`, locale) }}
      </h1>

      <p
        class="text-primary-comfy-canvas/80 max-w-xl text-base font-light lg:text-lg"
      >
        {{ t(`payment.${status}.subtitle`, locale) }}
      </p>

      <div
        class="mt-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center"
      >
        <BrandButton :href="primaryHref" variant="solid" size="nav">
          {{ t(`payment.${status}.primaryCta`, locale) }}
        </BrandButton>
        <BrandButton :href="secondaryHref" variant="outline" size="nav">
          {{ t(`payment.${status}.secondaryCta`, locale) }}
        </BrandButton>
      </div>
    </div>
  </section>
</template>

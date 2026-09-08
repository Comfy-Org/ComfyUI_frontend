<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import type { Locale } from '../../i18n/translations'
import { isDownloadLinkRequestEnabled } from '../../scripts/customerio'
import AgentBetaWaitlistForm from '../agent/AgentBetaWaitlistForm.vue'
import ProductHeroBadge from '../common/ProductHeroBadge.vue'

const {
  badgeText,
  title,
  subtitle,
  footnote,
  signupEvent,
  locale = 'en',
  class: className
} = defineProps<{
  badgeText?: string
  title: string
  subtitle?: string
  /**
   * Sits under the form and is hidden alongside it when signup is disabled,
   * so a promise to email never outlives the control that would collect it.
   */
  footnote?: string
  /** Customer.io event tracked on a successful signup. */
  signupEvent: string
  locale?: Locale
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section
    :class="
      cn(
        'relative isolate flex min-h-[56vh] items-center justify-center overflow-hidden px-6 pt-25 pb-12 text-primary-warm-white',
        className
      )
    "
  >
    <!-- Plum wash -->
    <div
      aria-hidden="true"
      class="animate-backdrop-sway absolute inset-[-20%] -z-4 bg-[radial-gradient(ellipse_50%_40%_at_30%_35%,color-mix(in_srgb,var(--color-primary-comfy-plum)_55%,transparent),transparent_70%),radial-gradient(ellipse_45%_45%_at_72%_62%,color-mix(in_srgb,var(--color-primary-comfy-plum)_38%,transparent),transparent_70%)] blur-2xl will-change-transform"
    />

    <!-- Even dot grid, then a brighter drifting cloud of dots masked over it -->
    <div
      aria-hidden="true"
      class="absolute inset-0 -z-3 bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-primary-warm-white)_16%,transparent)_1px,transparent_1.1px)] bg-size-[5px_5px]"
    />
    <div
      aria-hidden="true"
      class="animate-backdrop-drift absolute inset-0 -z-2 bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-primary-warm-white)_42%,transparent)_1.15px,transparent_1.25px)] mask-[radial-gradient(circle,black_0%,transparent_62%),radial-gradient(circle,black_0%,transparent_58%),radial-gradient(circle,black_0%,transparent_66%)] bg-size-[5px_5px] mask-[1100px_900px,800px_700px,1300px_1000px] mask-no-repeat will-change-[mask-position]"
    />

    <!-- Darkens the edges and blends the hero into the page background -->
    <div
      aria-hidden="true"
      class="absolute inset-0 -z-1 bg-[linear-gradient(to_bottom,transparent_55%,var(--color-primary-comfy-ink)_92%),radial-gradient(ellipse_65%_50%_at_50%_50%,color-mix(in_srgb,var(--color-primary-comfy-ink)_72%,transparent)_0%,color-mix(in_srgb,var(--color-primary-comfy-ink)_90%,transparent)_65%,color-mix(in_srgb,var(--color-primary-comfy-ink)_98%,transparent)_100%)]"
    />

    <div class="relative mx-auto max-w-190 text-center">
      <div
        v-if="badgeText"
        class="mx-auto mb-10 flex zoom-[0.85] justify-center"
      >
        <ProductHeroBadge :text="badgeText" />
      </div>

      <h1
        class="mb-7 text-[clamp(28px,4.2vw,48px)]/[1.18] font-light tracking-[-0.02em] text-primary-warm-white"
      >
        {{ title }}
      </h1>

      <p
        v-if="subtitle"
        class="mx-auto mb-10 max-w-140 text-[clamp(16px,2vw,19px)]/[1.6] text-primary-warm-white/82"
      >
        {{ subtitle }}
      </p>

      <AgentBetaWaitlistForm :signup-event="signupEvent" :locale="locale" />

      <p
        v-if="footnote && isDownloadLinkRequestEnabled"
        class="mx-auto mt-5 text-[11px]/[1.5] text-primary-warm-white/55"
      >
        {{ footnote }}
      </p>

      <slot />
    </div>
  </section>
</template>

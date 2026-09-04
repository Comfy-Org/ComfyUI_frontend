<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  locale = 'en',
  label,
  centerText = false,
  large = false,
  statusLabel
} = defineProps<{
  centerText?: boolean
  large?: boolean
  locale?: Locale
  label?: string
  statusLabel?: string
}>()
</script>

<template>
  <span
    :class="
      cn(
        'font-formula-narrow flex h-10 items-center font-semibold text-primary-comfy-ink',
        large ? 'md:h-19.75' : 'md:h-15.75'
      )
    "
  >
    <img
      src="/assets/platform/hero/badge-left.svg"
      alt=""
      class="-mr-0.5 h-full w-auto shrink-0"
      aria-hidden="true"
    />
    <span
      :class="
        cn(
          'bg-primary-comfy-yellow relative z-10 flex h-full shrink-0 items-center text-2xl leading-none tracking-[-0.02em] whitespace-nowrap uppercase',
          large ? 'md:text-[47.25px]' : 'md:text-[37.8px]'
        )
      "
    >
      <span
        :class="
          cn(
            'flex items-center gap-2',
            centerText ? 'translate-y-1' : 'translate-y-0.5'
          )
        "
      >
        <slot name="label">
          {{ label ?? t('platform.hero.badge', locale) }}
        </slot>
      </span>
    </span>
    <img
      src="/assets/platform/hero/badge-union.svg"
      alt=""
      class="-ml-0.5 h-full w-auto shrink-0 rotate-180"
      aria-hidden="true"
    />
    <span
      :class="
        cn(
          'bg-primary-comfy-yellow -ml-0.5 flex h-6.25 items-center px-0.5 text-[15px] leading-none tracking-[-0.02em] uppercase',
          large ? 'md:h-12.25 md:text-[29.25px]' : 'md:h-9.75 md:text-[23.4px]'
        )
      "
    >
      <span class="translate-y-0.5">
        {{ statusLabel ?? t('nav.badgeBeta', locale) }}
      </span>
    </span>
    <img
      src="/assets/platform/hero/badge-small-right.svg"
      alt=""
      :class="
        cn(
          '-ml-0.5 h-6.25 w-auto shrink-0 rotate-180',
          large ? 'md:h-12.25' : 'md:h-9.75'
        )
      "
      aria-hidden="true"
    />
  </span>
</template>

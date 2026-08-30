<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en', label } = defineProps<{
  locale?: Locale
  label?: string
}>()
</script>

<template>
  <span
    class="font-formula-narrow flex h-10 items-center font-semibold text-primary-comfy-ink md:h-15.75"
  >
    <img
      src="/assets/platform/hero/badge-left.svg"
      alt=""
      class="h-full w-auto shrink-0"
      aria-hidden="true"
    />
    <span
      class="bg-primary-comfy-yellow flex h-full items-center text-2xl leading-none tracking-[-0.02em] uppercase md:text-[37.8px]"
    >
      <span class="translate-y-0.5">
        {{ label ?? t('platform.hero.badge', locale) }}
      </span>
    </span>
    <img
      src="/assets/platform/hero/badge-union.svg"
      alt=""
      class="h-full w-auto shrink-0 rotate-180"
      aria-hidden="true"
    />
    <span
      class="bg-primary-comfy-yellow -ml-px flex h-6.25 items-center px-0.5 text-[15px] leading-none tracking-[-0.02em] uppercase md:h-9.75 md:text-[23.4px]"
    >
      <span class="translate-y-0.5">
        {{ t('nav.badgeBeta', locale) }}
      </span>
    </span>
    <img
      src="/assets/platform/hero/badge-small-right.svg"
      alt=""
      class="h-6.25 w-auto shrink-0 rotate-180 md:h-9.75"
      aria-hidden="true"
    />
  </span>
</template>

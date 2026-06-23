<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en', compact = false } = defineProps<{
  locale?: Locale
  compact?: boolean
}>()

const lines = computed(() => t('hero.title', locale).split('\n'))

const block =
  'inline-block rounded-2xl bg-primary-comfy-yellow px-5 py-2 font-formula-narrow leading-none font-semibold text-primary-comfy-ink uppercase'
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <h1 class="flex flex-col items-center">
      <span class="relative">
        <span :class="cn(block, compact ? 'text-3xl sm:text-4xl' : 'text-6xl')">
          {{ lines[0] }}
        </span>
        <span
          class="bg-primary-comfy-yellow absolute -bottom-1.5 left-1/2 size-4 -translate-1/2 rotate-45 rounded-[3px]"
        ></span>
      </span>
      <span
        :class="
          cn(block, 'mt-1.5', compact ? 'text-3xl sm:text-4xl' : 'text-6xl')
        "
      >
        {{ lines[1] }}
      </span>
    </h1>

    <p
      :class="
        cn(
          'mt-8 max-w-md text-primary-comfy-canvas',
          compact ? 'text-sm/relaxed' : 'text-base'
        )
      "
    >
      {{ t('hero.subtitle', locale) }}
    </p>
  </div>
</template>

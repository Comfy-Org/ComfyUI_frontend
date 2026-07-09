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

const size = computed(() => (compact ? 'text-3xl sm:text-4xl' : 'text-5xl'))

// Desktop splits the two lines apart so the connector bridges the gap; mobile
// stacks them tightly with no connector.
const lineGap = computed(() => (compact ? '-mt-2' : 'mt-[0.417em]'))

// Highlighter body is a plain block that auto-sizes to whatever localized text
// it holds; the caps and connector are traced from the source SVG (pill height
// 84.14, font 50.49) and re-expressed in `em`, so the whole graphic scales with
// the headline font size and fits any locale.
const capLeft =
  'M14.6876 83.8533H37.8645V0.290161C27.2139 0.290161 16.2164 8.87096 13.2743 19.4442L0.72226 64.6993C-2.20698 75.2725 4.03693 83.8533 14.6876 83.8533Z'
const capRight =
  'M23.177 0.29H0V83.8533C10.651 83.8533 21.649 75.2725 24.591 64.6993L37.143 19.4442C40.072 8.87096 33.828 0.29 23.177 0.29Z'
const link =
  'M0 21.036H33.657C27.982 21.036 23.37 16.321 23.37 10.518C23.37 4.715 27.961 0 33.657 0H0C5.676 0 10.287 4.715 10.287 10.518C10.287 16.321 5.676 21.036 0 21.036Z'

// PP Formula sits high in its em box; nudge glyphs down to read optically
// centered inside the highlighter.
const inner = 'relative top-[0.06em] inline-block'
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <h1 :class="cn('relative flex flex-col items-center', size)">
      <span
        v-for="(line, i) in lines"
        :key="i"
        :class="
          cn('text-primary-comfy-yellow flex items-stretch', i === 1 && lineGap)
        "
      >
        <svg
          class="h-[1.667em] w-[0.75em] shrink-0 overflow-visible"
          viewBox="0 0 37.8645 84.1434"
          preserveAspectRatio="none"
          fill="currentColor"
          aria-hidden="true"
        >
          <path :d="capLeft" />
        </svg>
        <span
          class="bg-primary-comfy-yellow font-formula-narrow -mx-px flex h-[1.667em] items-center px-[0.05em] leading-none font-semibold text-primary-comfy-ink uppercase"
        >
          <span :class="inner">{{ line }}</span>
        </span>
        <svg
          class="h-[1.667em] w-[0.736em] shrink-0 overflow-visible"
          viewBox="0 0 37.143 84.1434"
          preserveAspectRatio="none"
          fill="currentColor"
          aria-hidden="true"
        >
          <path :d="capRight" />
        </svg>
      </span>

      <svg
        v-if="!compact"
        class="hero-headline-link text-primary-comfy-yellow absolute top-1/2 left-1/2 h-[0.417em] w-[0.667em]"
        viewBox="0 0 33.657 21.036"
        preserveAspectRatio="none"
        fill="currentColor"
        aria-hidden="true"
      >
        <path :d="link" />
      </svg>
    </h1>

    <p
      :class="
        cn(
          'max-w-md text-primary-comfy-canvas',
          compact ? 'mt-5 hidden text-sm/relaxed sm:block' : 'mt-8 text-base'
        )
      "
    >
      {{ t('hero.subtitle', locale) }}
    </p>
  </div>
</template>

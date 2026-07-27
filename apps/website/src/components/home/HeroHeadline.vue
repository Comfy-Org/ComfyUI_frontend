<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'

import BrandButton from '../common/BrandButton.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en', compact = false } = defineProps<{
  locale?: Locale
  compact?: boolean
}>()

const lines = computed(() => t('hero.title', locale).split('\n'))

const size = computed(() => (compact ? 'text-3xl sm:text-4xl' : 'text-5xl'))

const lineGap = computed(() => (compact ? '-mt-2' : 'mt-2'))

const pill =
  'inline-block rounded-2xl px-5 py-2 font-formula-narrow leading-none font-semibold uppercase'

// PP Formula Narrow sits high in its em box; nudge the glyphs down so they read
// optically centered inside the highlighter block.
const inner = 'relative top-[0.06em] inline-block'
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <h1 class="flex flex-col items-center">
      <span
        :class="
          cn(pill, size, 'bg-primary-comfy-yellow text-primary-comfy-ink')
        "
      >
        <span :class="inner">{{ lines[0] }}</span>
      </span>
      <span
        :class="
          cn(
            pill,
            size,
            'bg-primary-comfy-yellow text-primary-comfy-ink',
            lineGap
          )
        "
      >
        <span :class="inner">{{ lines[1] }}</span>
      </span>
    </h1>

    <p
      :class="
        cn(
          'max-w-md text-primary-comfy-canvas',
          compact ? 'mt-5 text-sm/relaxed' : 'mt-8 text-base'
        )
      "
    >
      {{ t('hero.subtitle', locale) }}
    </p>

    <BrandButton
      :href="externalLinks.cloud"
      target="_blank"
      variant="outline"
      size="nav"
      :class="cn('uppercase', compact ? 'mt-5' : 'mt-7')"
    >
      {{ t('hero.cta.cloud', locale) }}
    </BrandButton>
  </div>
</template>

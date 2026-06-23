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

const size = computed(() => (compact ? 'text-3xl sm:text-4xl' : 'text-6xl'))

const pill =
  'inline-block rounded-2xl px-5 py-2 font-formula-narrow leading-none font-semibold uppercase'

// PP Formula Narrow sits high in its em box; nudge the glyphs down so they read
// optically centered inside the highlighter block.
const inner = 'relative top-[0.06em] inline-block'
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <div class="inline-grid">
      <!-- Liquid yellow backing: the two pills merge through the goo filter
           (defined once in HeroSection). Text is transparent here, present only
           so each pill sizes to its line. -->
      <div
        class="col-start-1 row-start-1 flex flex-col items-center"
        style="filter: url(#hero-goo)"
        aria-hidden="true"
      >
        <span
          :class="cn(pill, size, 'bg-primary-comfy-yellow text-transparent')"
        >
          {{ lines[0] }}
        </span>
        <span
          :class="
            cn(pill, size, 'bg-primary-comfy-yellow -mt-2 text-transparent')
          "
        >
          {{ lines[1] }}
        </span>
      </div>

      <!-- Crisp dark text on top of the liquid backing -->
      <h1 class="col-start-1 row-start-1 flex flex-col items-center">
        <span :class="cn(pill, size, 'text-primary-comfy-ink')">
          <span :class="inner">{{ lines[0] }}</span>
        </span>
        <span :class="cn(pill, size, '-mt-2 text-primary-comfy-ink')">
          <span :class="inner">{{ lines[1] }}</span>
        </span>
      </h1>
    </div>

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

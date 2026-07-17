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

// Desktop splits the two lines apart so the liquid link reads as a bridge
// travelling between them; mobile keeps them tightly stacked (no link there).
const lineGap = computed(() => (compact ? '-mt-2' : 'mt-4'))

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
        class="relative col-start-1 row-start-1 flex flex-col items-center"
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
            cn(pill, size, 'bg-primary-comfy-yellow text-transparent', lineGap)
          "
        >
          {{ lines[1] }}
        </span>
        <span
          v-if="!compact"
          class="hero-liquid-link bg-primary-comfy-yellow pointer-events-none absolute top-1/2 left-1/2 h-9 w-5 rounded-full"
        />
      </div>

      <!-- Crisp dark text on top of the liquid backing -->
      <h1 class="col-start-1 row-start-1 flex flex-col items-center">
        <span :class="cn(pill, size, 'text-primary-comfy-ink')">
          <span :class="inner">{{ lines[0] }}</span>
        </span>
        <span :class="cn(pill, size, 'text-primary-comfy-ink', lineGap)">
          <span :class="inner">{{ lines[1] }}</span>
        </span>
      </h1>
    </div>

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

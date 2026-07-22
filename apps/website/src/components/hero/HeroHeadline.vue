<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const lines = t('hero.title', locale).split('\n')

// All internal sizing is em-relative to the inherited font size, so the
// lockup scales with whatever context renders it (canvas overlay or flow).
const pill =
  'font-formula-narrow inline-block rounded-[0.35em] px-[0.42em] py-[0.16em] leading-none font-semibold uppercase'

// PP Formula Narrow sits high in its em box; nudge the glyphs down so they
// read optically centered inside the highlighter block.
const inner = 'relative top-[0.06em] inline-block'

const lineGap = 'mt-[0.33em]'
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <!-- Goo filter: blur + alpha contrast fuses the pills and the bridge into
         a single liquid shape. -->
    <svg class="absolute size-0" aria-hidden="true">
      <defs>
        <filter id="hero-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b" />
          <feColorMatrix
            in="b"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
          />
        </filter>
      </defs>
    </svg>

    <div class="inline-grid">
      <!-- Liquid yellow backing: text is transparent here, present only so
           each pill sizes to its line. The bridge pill is static. -->
      <div
        class="relative col-start-1 row-start-1 flex flex-col items-center"
        style="filter: url(#hero-goo)"
        aria-hidden="true"
      >
        <span :class="cn(pill, 'bg-primary-comfy-yellow text-transparent')">
          {{ lines[0] }}
        </span>
        <span
          :class="cn(pill, 'bg-primary-comfy-yellow text-transparent', lineGap)"
        >
          {{ lines[1] }}
        </span>
        <span
          class="bg-primary-comfy-yellow pointer-events-none absolute top-1/2 left-1/2 h-[0.75em] w-[0.42em] -translate-1/2 scale-y-[1.03] rounded-full"
        />
      </div>

      <!-- Crisp dark text on top of the liquid backing -->
      <h1 class="col-start-1 row-start-1 flex flex-col items-center">
        <span :class="cn(pill, 'text-primary-comfy-ink')">
          <span :class="inner">{{ lines[0] }}</span>
        </span>
        <span :class="cn(pill, 'text-primary-comfy-ink', lineGap)">
          <span :class="inner">{{ lines[1] }}</span>
        </span>
      </h1>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const lines = t('hero.title', locale).split('\n')

// Sizing is em-relative to the inherited font size so the lockup scales with
// whatever context renders it (canvas overlay or mobile flow).
const cap = '-mx-px h-full w-auto self-stretch'

// PP Formula Narrow sits high in its em box; nudge the glyphs down so they
// read optically centred between the caps.
const inner = 'inline-block translate-y-[0.11em] whitespace-nowrap'
</script>

<template>
  <h1
    class="font-formula-narrow flex flex-col items-center font-semibold tracking-[-0.02em] uppercase"
  >
    <template v-for="(line, i) in lines" :key="line">
      <!-- The link piece keeps a floor size: purely em-proportional it
           shrinks to an illegible nub on small canvases. -->
      <img
        v-if="i > 0"
        src="/icons/node-union-vertical.svg"
        alt=""
        class="h-[max(0.265em,0.75rem)] w-[max(0.423em,1.2rem)]"
        aria-hidden="true"
      />
      <span class="flex h-[1.667em] items-stretch">
        <img
          src="/icons/node-left.svg"
          alt=""
          :class="cap"
          aria-hidden="true"
        />
        <span
          class="bg-primary-comfy-yellow flex items-center leading-none text-primary-comfy-ink"
        >
          <span :class="inner">{{ line }}</span>
        </span>
        <img
          src="/icons/node-right.svg"
          alt=""
          :class="cap"
          aria-hidden="true"
        />
      </span>
    </template>
  </h1>
</template>

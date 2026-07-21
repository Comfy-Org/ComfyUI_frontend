<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const lines = t('hero.title', locale).split('\n')
const tilts = ['-rotate-[1.5deg]', 'rotate-[1deg]']
</script>

<template>
  <h1 class="flex flex-col items-center gap-3">
    <span class="sr-only">{{ lines.join(' ') }}</span>
    <span
      v-for="(line, i) in lines"
      :key="line"
      aria-hidden="true"
      :class="tilts[i % tilts.length]"
      class="bg-primary-comfy-yellow inline-block skew-x-[-9deg] rounded-[0.1em] px-[0.55em] py-[0.1em]"
    >
      <span
        class="font-formula inline-block skew-x-[9deg] text-3xl font-bold tracking-tight text-primary-comfy-ink uppercase lg:text-5xl"
      >
        {{ line }}
      </span>
    </span>
  </h1>
</template>

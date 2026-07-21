<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const title = t('hero.title', locale)
const lines = title.split('\n').map((line) => line.toUpperCase())
const lineClasses = ['-rotate-[1.5deg]', 'rotate-[1deg] -mt-2 translate-x-2']
</script>

<template>
  <div class="flex flex-col items-center">
    <h1 class="sr-only">{{ title.split('\n').join(' ') }}</h1>
    <span
      v-for="(line, i) in lines"
      :key="line"
      aria-hidden="true"
      :class="lineClasses[i % lineClasses.length]"
      class="bg-primary-comfy-yellow inline-block skew-x-[-8deg] rounded-[0.35em] px-[0.65em] py-[0.12em]"
    >
      <span
        class="font-formula inline-block skew-x-[8deg] text-2xl font-bold tracking-tight text-primary-comfy-ink uppercase sm:text-3xl lg:text-5xl"
      >
        {{ line }}
      </span>
    </span>
  </div>
</template>

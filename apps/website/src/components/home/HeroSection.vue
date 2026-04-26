<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import HeroCanvas from './HeroCanvas.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="bg-primary-comfy-ink relative overflow-hidden">
    <!--
      Text sits in normal flow and drives the section height via min-h. The
      canvas is layered above with z-10 and captures all pointer events, so the
      text appears *behind* the nodes and the drag/slider interactions work
      across the entire hero — including over the text itself.
    -->
    <div
      class="relative flex min-h-[680px] items-center px-6 py-14 lg:min-h-[900px] lg:justify-end lg:p-16"
    >
      <div class="w-full lg:max-w-xl">
        <h1
          class="text-primary-comfy-canvas text-4xl font-light whitespace-pre-line lg:text-6xl"
        >
          {{ t('hero.title', locale) }}
        </h1>

        <p
          class="text-primary-comfy-canvas mt-8 max-w-lg text-sm/relaxed lg:text-base"
        >
          {{ t('hero.subtitle', locale) }}
        </p>
      </div>
    </div>

    <!--
      Canvas absolute-fills the section on every viewport. Because it sits on
      top of the text (z-10) and is transparent except for the nodes, users
      can drag nodes freely across the whole hero, over the copy included.
    -->
    <div class="absolute inset-0 z-10">
      <HeroCanvas />
    </div>
  </section>
</template>

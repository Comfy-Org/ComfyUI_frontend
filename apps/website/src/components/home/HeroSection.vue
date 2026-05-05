<script setup lang="ts">
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { externalLinks } from '../../config/routes'
import { useHeroLogo } from '../../composables/useHeroLogo'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const logoContainer = ref<HTMLElement>()
useHeroLogo(logoContainer)
</script>

<template>
  <section
    class="relative flex min-h-auto flex-col lg:flex-row lg:items-center"
  >
    <div
      ref="logoContainer"
      class="relative flex aspect-square w-full flex-1 items-center justify-center"
    >
      <img
        src="https://media.comfy.org/website/homepage/hero-logo-seq/Logo00.webp"
        alt="Comfy logo"
        class="w-3/5"
      />
    </div>

    <div class="flex-1 px-6 py-12 lg:px-16">
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

      <BrandButton
        :href="externalLinks.workflows"
        variant="outline"
        size="lg"
        class="mt-8 w-full p-4 uppercase lg:w-auto lg:min-w-60"
      >
        {{ t('hero.runFirstWorkflow', locale) }}
      </BrandButton>
    </div>
  </section>
</template>

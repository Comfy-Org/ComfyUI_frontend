<script setup lang="ts">
import { ref } from 'vue'

import { useHeroAnimation } from '../../composables/useHeroAnimation'
import SectionLabel from '../common/SectionLabel.vue'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'
import { ScrollTrigger } from '../../scripts/gsapSetup'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const sectionRef = ref<HTMLElement>()
const logoRef = ref<HTMLElement>()
const labelRef = ref<HTMLElement>()
const headingRef = ref<HTMLElement>()
const bodyRef = ref<HTMLElement>()

useHeroAnimation({
  section: sectionRef,
  textEls: [labelRef, headingRef, bodyRef],
  logo: logoRef
})

function handleLogoLoad() {
  ScrollTrigger.refresh(true)
}
</script>

<template>
  <section ref="sectionRef" class="pt-12 lg:pt-14">
    <div
      class="flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left"
    >
      <div ref="logoRef" class="hidden lg:block lg:w-1/3">
        <img
          src="https://media.comfy.org/website/customers/c-projection.webp"
          alt="Comfy 3D logo"
          width="1568"
          height="1763"
          class="aspect-1568/1480 h-auto w-full object-cover object-top"
          @load="handleLogoLoad"
        />
      </div>

      <div
        class="flex flex-col items-center px-6 lg:w-2/3 lg:items-start lg:pr-16 lg:pl-12"
      >
        <SectionLabel ref="labelRef">
          {{ t('customers.hero.label') }}
        </SectionLabel>
        <h1
          ref="headingRef"
          class="mt-4 text-4xl/tight font-light text-primary-comfy-canvas lg:max-w-4xl lg:text-6xl"
        >
          {{ t('customers.hero.heading') }}
        </h1>
        <p
          ref="bodyRef"
          class="mt-6 max-w-lg text-base text-primary-comfy-canvas"
        >
          {{ t('customers.hero.body') }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchSteps } from './types'

import BrandButton from '../../components/common/BrandButton.vue'
import { t } from '../../i18n/translations'

const { locale = 'en', steps } = defineProps<{
  steps: ModelLaunchSteps
  locale?: Locale
}>()

const stepNumber = (index: number) => String(index + 1).padStart(2, '0')
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t(steps.headingKey, locale) }}
      </h2>
    </div>

    <ol
      :class="
        cn(
          'rounded-5xl bg-transparency-white-t4 mt-12 grid grid-cols-1 gap-4 p-4 lg:gap-2 lg:p-2',
          steps.items.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
        )
      "
    >
      <li
        v-for="(step, index) in steps.items"
        :key="step.id"
        class="rounded-4.5xl flex flex-col gap-8 bg-primary-comfy-ink p-6"
      >
        <p
          class="text-primary-comfy-yellow text-sm/tight font-extrabold tracking-wider uppercase"
        >
          {{ t(steps.stepLabelKey, locale) }} {{ stepNumber(index) }}
        </p>
        <p class="text-2xl/snug font-medium text-primary-warm-white">
          {{ step.title[locale] }}
        </p>
        <p
          v-if="step.description"
          class="text-[17px]/relaxed font-light text-primary-comfy-canvas"
        >
          {{ step.description[locale] }}
        </p>
      </li>
    </ol>

    <div
      v-if="steps.primaryCta || steps.secondaryCta"
      class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
    >
      <BrandButton
        v-if="steps.primaryCta"
        :href="steps.primaryCta.href"
        :target="steps.primaryCta.target"
        variant="solid"
        size="lg"
        class="w-full p-4 text-center sm:w-auto sm:min-w-52"
      >
        {{ t(steps.primaryCta.labelKey, locale) }}
      </BrandButton>
      <BrandButton
        v-if="steps.secondaryCta"
        :href="steps.secondaryCta.href"
        :target="steps.secondaryCta.target"
        variant="outline"
        size="lg"
        class="w-full p-4 text-center sm:w-auto sm:min-w-52"
      >
        {{ t(steps.secondaryCta.labelKey, locale) }}
      </BrandButton>
    </div>
  </section>
</template>

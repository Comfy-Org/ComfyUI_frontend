<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks, getRoutes } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const steps = [
  {
    number: 'mcp.howItWorks.step1.number',
    titleKey: 'mcp.howItWorks.step1.title',
    descriptionKey: 'mcp.howItWorks.step1.description'
  },
  {
    number: 'mcp.howItWorks.step2.number',
    titleKey: 'mcp.howItWorks.step2.title',
    descriptionKey: 'mcp.howItWorks.step2.description'
  },
  {
    number: 'mcp.howItWorks.step3.number',
    titleKey: 'mcp.howItWorks.step3.title',
    descriptionKey: 'mcp.howItWorks.step3.description'
  }
] as const
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-24 lg:px-20">
    <h2
      class="mb-12 text-center text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
    >
      {{ t('mcp.howItWorks.heading', locale) }}
    </h2>

    <!-- Cards row with node-link connectors between them -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0">
      <template v-for="(step, i) in steps" :key="step.number">
        <!-- Node link connector (between cards, desktop only) -->
        <div
          v-if="i > 0"
          class="relative z-10 -mx-px hidden shrink-0 items-center justify-center self-stretch lg:flex"
          aria-hidden="true"
        >
          <img src="/icons/node-link.svg" alt="" class="h-8 w-5" />
        </div>

        <!-- Card -->
        <div
          class="border-primary-comfy-yellow flex flex-1 flex-col rounded-[40px] border-2 bg-primary-comfy-ink p-2"
        >
          <div class="flex flex-1 flex-col gap-6 p-8">
            <div>
              <p
                class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
              >
                {{ t(step.number, locale) }}
              </p>
              <h3
                class="mt-1 text-2xl font-medium tracking-widest text-primary-comfy-canvas uppercase"
              >
                {{ t(step.titleKey, locale) }}
              </h3>
            </div>
            <p class="text-sm/relaxed text-primary-comfy-canvas/70">
              {{ t(step.descriptionKey, locale) }}
            </p>
          </div>
        </div>
      </template>
    </div>

    <div
      class="mt-12 flex flex-col items-center gap-4 lg:flex-row lg:justify-center"
    >
      <BrandButton
        :href="externalLinks.docsMcp"
        variant="outline"
        size="lg"
        class="w-full text-center lg:w-auto lg:min-w-48"
      >
        {{ t('mcp.hero.viewDocs', locale) }}
      </BrandButton>
      <BrandButton
        :href="routes.cloud"
        variant="solid"
        size="lg"
        class="w-full text-center lg:w-auto lg:min-w-48"
      >
        {{ t('mcp.hero.runWorkflow', locale) }}
      </BrandButton>
    </div>
  </section>
</template>

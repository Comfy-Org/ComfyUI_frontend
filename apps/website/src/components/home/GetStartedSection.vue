<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)

const steps = [
  {
    number: '1',
    title: t('getStarted.step1.title', locale),
    description: '',
    links: [
      {
        label: t('getStarted.step1.downloadLocal', locale),
        href: routes.download
      },
      {
        label: t('getStarted.step1.launchCloud', locale),
        href: externalLinks.app
      }
    ]
  },
  {
    number: '2',
    title: t('getStarted.step2.title', locale),
    description: t('getStarted.step2.description', locale)
  },
  {
    number: '3',
    title: t('getStarted.step3.title', locale),
    description: t('getStarted.step3.description', locale)
  }
]
</script>

<template>
  <section class="bg-primary-comfy-ink px-4 py-40 lg:px-20">
    <div class="flex flex-col gap-12 lg:flex-row lg:gap-8">
      <!-- Left heading -->
      <div
        class="bg-primary-comfy-ink sticky top-20 shrink-0 py-2 lg:top-28 lg:w-115 lg:self-start"
      >
        <h2 class="text-primary-comfy-canvas text-5xl font-light">
          {{ t('getStarted.heading', locale) }}
        </h2>
        <p class="text-primary-comfy-canvas mt-8 text-base">
          {{ t('getStarted.subheading', locale) }}
        </p>
      </div>

      <!-- Right steps -->
      <div class="flex-1">
        <div
          v-for="step in steps"
          :key="step.number"
          class="border-primary-comfy-canvas flex flex-col gap-4 border-b py-12 first:pt-0 last:border-b lg:flex-row lg:items-start lg:gap-8"
        >
          <span
            class="text-primary-comfy-canvas w-16 shrink-0 text-6xl font-light lg:text-7xl"
          >
            {{ step.number }}
          </span>
          <h3
            class="text-primary-comfy-canvas shrink-0 text-2xl font-light lg:w-84"
          >
            {{ step.title }}
          </h3>
          <p
            v-if="step.description"
            class="text-primary-comfy-canvas flex-1 text-sm"
          >
            {{ step.description }}
          </p>
          <p v-if="step.links" class="flex-1 text-sm">
            <template v-for="(link, i) in step.links" :key="link.href">
              <a
                :href="link.href"
                class="text-primary-comfy-yellow hover:underline"
              >
                {{ link.label }}
              </a>
              <span
                v-if="i < step.links.length - 1"
                class="text-primary-comfy-canvas"
              >
                {{ t('getStarted.step1.or', locale) }}
              </span>
            </template>
            <span class="text-primary-comfy-canvas">.</span>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

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
        href: externalLinks.cloud
      }
    ]
  },
  {
    number: '2',
    title: t('getStarted.step2.title', locale)
  },
  {
    number: '3',
    title: t('getStarted.step3.title', locale),
    description: t('getStarted.step3.description', locale)
  }
]
</script>

<template>
  <section
    class="max-w-9xl mx-auto bg-primary-comfy-ink px-4 py-20 lg:px-20 lg:py-24"
  >
    <div class="flex flex-col gap-12 lg:flex-row lg:gap-8">
      <!-- Left heading -->
      <div
        class="sticky top-20 shrink-0 bg-primary-comfy-ink py-2 lg:top-28 lg:w-115 lg:self-start"
      >
        <h2 class="text-5xl font-light text-primary-comfy-canvas">
          {{ t('getStarted.heading', locale) }}
        </h2>
        <p class="mt-8 text-base text-primary-comfy-canvas">
          {{ t('getStarted.subheading', locale) }}
        </p>
      </div>

      <!-- Right steps -->
      <div class="flex-1">
        <div
          v-for="step in steps"
          :key="step.number"
          class="flex flex-col gap-4 border-b border-primary-comfy-canvas py-12 first:pt-0 last:border-b lg:flex-row lg:items-start lg:gap-8"
        >
          <span
            class="w-16 shrink-0 text-6xl font-light text-primary-comfy-canvas lg:text-7xl"
          >
            {{ step.number }}
          </span>
          <h3
            class="shrink-0 text-2xl font-light text-primary-comfy-canvas lg:w-84"
          >
            {{ step.title }}
          </h3>
          <p
            v-if="step.description"
            class="flex-1 text-sm text-primary-comfy-canvas"
          >
            {{ step.description }}
          </p>
          <p
            v-else-if="step.number === '2'"
            class="flex-1 text-sm text-primary-comfy-canvas"
          >
            {{ t('getStarted.step2.descriptionPrefix', locale)
            }}<a
              :href="externalLinks.workflows"
              class="text-primary-comfy-yellow hover:underline"
              >{{ t('getStarted.step2.descriptionLink', locale) }}</a
            >{{ t('getStarted.step2.descriptionSuffix', locale) }}
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

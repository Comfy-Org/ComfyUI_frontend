<script setup lang="ts">
import Badge from '../ui/badge/Badge.vue'
import Button from '../ui/button/Button.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import DeployTerminal from '../../templates/platform/DeployTerminal.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const products = [
  {
    label: t('platform.products.serverless.title', locale),
    href: routes.platformServerless
  },
  {
    label: t('platform.products.models.title', locale),
    href: routes.platformModels
  },
  {
    label: t('platform.products.builder.title', locale),
    href: routes.platformBuilder
  }
]
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-14 md:py-20 lg:px-12">
    <div
      class="bg-transparency-white-t4 lg:rounded-5xl grid grid-cols-1 gap-6 rounded-4xl p-2 lg:grid-cols-2 lg:gap-8"
    >
      <div class="flex flex-col justify-center gap-5 p-6 lg:p-10">
        <div class="flex items-center gap-3">
          <p
            class="text-primary-comfy-yellow text-sm font-bold tracking-[0.7px] uppercase"
          >
            {{ t('home.platform.eyebrow', locale) }}
          </p>
          <Badge variant="accent" size="xs">
            {{ t('nav.badgeBeta', locale) }}
          </Badge>
        </div>

        <h2
          class="text-3xl leading-[125%] font-light text-primary-comfy-canvas lg:text-4xl"
        >
          {{ t('home.platform.heading', locale) }}
        </h2>

        <p
          class="max-w-xl text-base/relaxed font-light text-primary-comfy-canvas"
        >
          {{ t('home.platform.body', locale) }}
        </p>

        <ul class="flex flex-wrap gap-2">
          <li v-for="product in products" :key="product.href">
            <a
              :href="product.href"
              class="focus-visible:ring-primary-comfy-yellow/50 inline-flex items-center rounded-full border border-white/15 bg-white/4 px-3.5 py-1.5 font-mono text-xs text-primary-comfy-canvas transition-colors hover:border-white/30 hover:bg-white/8 focus-visible:ring-2 focus-visible:outline-none"
            >
              {{ product.label }}
            </a>
          </li>
        </ul>

        <div class="mt-2 flex flex-wrap gap-3 xl:flex-nowrap">
          <Button as="a" :href="routes.platform" class="whitespace-nowrap">
            {{ t('home.platform.cta', locale) }}
          </Button>
          <Button
            as="a"
            :href="externalLinks.docsPlatform"
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            {{ t('home.platform.docs', locale) }}
          </Button>
        </div>
      </div>

      <div class="flex items-center p-2 lg:p-4">
        <DeployTerminal :locale="locale" class="w-full" />
      </div>
    </div>
  </section>
</template>

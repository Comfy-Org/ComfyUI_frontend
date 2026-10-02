<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'

import { apiKeysLink, externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
const PATHS = [
  {
    key: 'router',
    title: 'workshop.build.routerTitle',
    body: 'workshop.build.routerBody',
    href: routes.platformRouter
  },
  {
    key: 'api',
    title: 'workshop.build.apiTitle',
    body: 'workshop.build.apiBody',
    href: routes.platformComfyApi
  },
  {
    key: 'platform',
    title: 'workshop.build.platformTitle',
    body: 'workshop.build.platformBody',
    href: routes.platform
  }
] as const

const SNIPPET = `curl https://api.comfy.org/v2/models/{provider}/{model} \\
  --header "X-API-Key: $COMFY_API_KEY" \\
  --header "Idempotency-Key: $(uuidgen)" \\
  --header "Content-Type: application/json" \\
  --data '{ … }'`
</script>

<template>
  <section
    class="mb-12 grid gap-6 rounded-3xl border border-transparency-white-t8 p-6 lg:grid-cols-2 lg:p-8"
    aria-labelledby="build-api-title"
    data-testid="build-api-band"
  >
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h2
          id="build-api-title"
          class="text-2xl font-medium text-primary-warm-white"
        >
          {{ t('workshop.build.title', locale) }}
        </h2>
        <p class="text-sm text-content-secondary">
          {{ t('workshop.build.body', locale) }}
        </p>
      </div>
      <ul class="flex flex-col gap-1">
        <li v-for="path in PATHS" :key="path.key">
          <a
            :href="path.href"
            class="group flex items-start justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors outline-none hover:bg-transparency-white-t4 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          >
            <span class="flex flex-col">
              <span class="text-sm font-medium text-content-bright">
                {{ t(path.title, locale) }}
              </span>
              <span class="text-sm text-content-secondary">
                {{ t(path.body, locale) }}
              </span>
            </span>
            <ArrowUpRight
              class="mt-0.5 size-4 shrink-0 text-primary-warm-gray transition-colors group-hover:text-primary-comfy-yellow"
              aria-hidden="true"
            />
          </a>
        </li>
      </ul>
      <div class="flex flex-wrap gap-3">
        <a
          :href="apiKeysLink({ onboarding: 'router' })"
          class="inline-flex h-11 items-center rounded-2xl bg-primary-comfy-yellow px-6 text-sm font-bold text-primary-comfy-ink transition-colors outline-none hover:bg-primary-comfy-yellow/90 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          data-testid="build-api-key"
        >
          {{ t('workshop.build.getKey', locale) }}
        </a>
        <a
          :href="externalLinks.docsComfyRouter"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-11 items-center gap-1 rounded-2xl border border-transparency-white-t20 px-6 text-sm font-medium text-primary-warm-white transition-colors outline-none hover:border-primary-warm-gray focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        >
          {{ t('workshop.build.docs', locale) }}
          <ArrowUpRight class="size-4" aria-hidden="true" />
        </a>
      </div>
    </div>
    <pre
      class="overflow-x-auto rounded-2xl bg-transparency-white-t4 p-5 font-mono text-xs/6 text-content-secondary"
      :aria-label="t('workshop.build.snippetLabel', locale)"
    ><code>{{ SNIPPET }}</code></pre>
  </section>
</template>

<script setup lang="ts">
import { ArrowUpRight, KeyRound, Route, Workflow } from '@lucide/vue'

import { apiKeysLink, externalLinks, getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const routes = getRoutes(locale)
const PATHS = [
  {
    key: 'router',
    icon: Route,
    title: 'workshop.build.routerTitle',
    body: 'workshop.build.routerBody',
    href: routes.platformRouter
  },
  {
    key: 'api',
    icon: Workflow,
    title: 'workshop.build.apiTitle',
    body: 'workshop.build.apiBody',
    href: routes.platformComfyApi
  },
  {
    key: 'platform',
    icon: KeyRound,
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
    class="mb-12 flex flex-col gap-6 rounded-3xl bg-hub-surface p-6 lg:p-10"
    aria-labelledby="build-api-title"
    data-testid="build-api-band"
  >
    <div class="grid gap-8 lg:grid-cols-2 lg:items-center">
      <div class="flex flex-col items-start gap-5">
        <h2
          id="build-api-title"
          class="text-3xl font-light text-primary-warm-white lg:text-4xl"
        >
          {{ t('workshop.build.title') }}
        </h2>
        <p class="max-w-md text-base text-content-secondary">
          {{ t('workshop.build.body') }}
        </p>
        <div class="flex flex-wrap gap-3">
          <a
            :href="apiKeysLink({ onboarding: 'router' })"
            class="inline-flex h-11 items-center rounded-2xl bg-primary-comfy-yellow px-6 text-sm font-bold text-primary-comfy-ink transition-colors outline-none hover:bg-primary-comfy-yellow/90 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
            data-testid="build-api-key"
          >
            {{ t('workshop.build.getKey') }}
          </a>
          <a
            :href="externalLinks.docsComfyRouter"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-11 items-center gap-1 rounded-2xl border border-transparency-white-t20 px-6 text-sm font-medium text-primary-warm-white transition-colors outline-none hover:border-primary-warm-gray focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          >
            {{ t('workshop.build.docs') }}
            <ArrowUpRight class="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
      <div
        class="overflow-hidden rounded-2xl bg-primary-comfy-ink ring-1 ring-transparency-white-t8"
      >
        <div
          class="flex gap-1.5 border-b border-transparency-white-t8 px-4 py-3"
          aria-hidden="true"
        >
          <span class="size-2.5 rounded-full bg-transparency-white-t20" />
          <span class="size-2.5 rounded-full bg-transparency-white-t20" />
          <span class="size-2.5 rounded-full bg-primary-comfy-yellow" />
        </div>
        <pre
          class="overflow-x-auto p-5 font-mono text-xs/6 text-content-secondary"
          :aria-label="t('workshop.build.snippetLabel')"
        ><code>{{ SNIPPET }}</code></pre>
      </div>
    </div>
    <ul class="grid gap-3 md:grid-cols-3">
      <li v-for="path in PATHS" :key="path.key">
        <a
          :href="path.href"
          class="group flex h-full items-start gap-4 rounded-2xl bg-transparency-white-t4 p-5 transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-comfy-yellow/10 text-primary-comfy-yellow"
            aria-hidden="true"
          >
            <component :is="path.icon" class="size-5" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="text-base font-medium text-content-bright">
              {{ t(path.title) }}
            </span>
            <span class="text-sm text-content-secondary">
              {{ t(path.body) }}
            </span>
          </span>
          <ArrowUpRight
            class="size-4 shrink-0 text-primary-warm-gray transition-colors group-hover:text-primary-comfy-yellow"
            aria-hidden="true"
          />
        </a>
      </li>
    </ul>
  </section>
</template>

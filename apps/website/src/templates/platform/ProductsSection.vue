<script setup lang="ts">
import Button from '../../components/ui/button/Button.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BuilderVisual from './BuilderVisual.vue'
import CodeTabs from './CodeTabs.vue'
import { modelsApiCodeTabs } from './codeSamples'
import { platformCtas } from './ctas'
import ServerlessVisual from './ServerlessVisual.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
const ctas = platformCtas(locale)

const modelsTabs = modelsApiCodeTabs
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <!-- Serverless API: the headline product, full width -->
    <article
      id="serverless"
      class="group bg-transparency-white-t4 relative grid scroll-mt-24 grid-cols-1 items-center gap-8 rounded-4xl border border-white/10 p-6 transition-colors hover:border-white/25 lg:scroll-mt-36 lg:grid-cols-2 lg:gap-12 lg:p-10"
    >
      <a
        :href="routes.platformServerless"
        :aria-label="t('platform.products.serverless.title', locale)"
        class="absolute inset-0 rounded-4xl"
      ></a>
      <div>
        <h3 class="text-lg font-normal text-primary-warm-white lg:text-xl">
          {{ t('platform.products.serverless.title', locale) }}
        </h3>
        <p class="mt-3 text-sm/relaxed font-light text-primary-comfy-canvas">
          {{ t('platform.products.serverless.description', locale) }}
        </p>
        <div class="relative z-10 mt-8 w-fit">
          <Button
            as="a"
            :href="ctas.getStarted.href"
            :target="ctas.getStarted.target"
            rel="noopener noreferrer"
            variant="outline"
          >
            {{ ctas.getStarted.label }}
          </Button>
        </div>
      </div>
      <ServerlessVisual />
    </article>

    <!-- Comfy Router and Builder, side by side -->
    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <article
        id="models"
        class="group/models bg-transparency-white-t4 relative flex scroll-mt-24 flex-col rounded-4xl border border-white/10 p-6 transition-colors hover:border-white/25 lg:scroll-mt-36 lg:p-10"
      >
        <a
          :href="routes.platformModels"
          :aria-label="t('platform.products.models.title', locale)"
          class="absolute inset-0 rounded-4xl"
        ></a>
        <h3 class="text-lg font-normal text-primary-warm-white lg:text-xl">
          {{ t('platform.products.models.title', locale) }}
        </h3>
        <p class="mt-3 text-sm/relaxed font-light text-primary-comfy-canvas">
          {{ t('platform.products.models.description', locale) }}
        </p>
        <div class="relative z-10 mt-6">
          <CodeTabs
            :tabs="modelsTabs"
            :aria-label="t('platform.products.models.title', locale)"
          />
        </div>
        <div class="relative z-10 mt-auto w-fit pt-8">
          <Button
            as="a"
            :href="ctas.getStarted.href"
            :target="ctas.getStarted.target"
            rel="noopener noreferrer"
            variant="outline"
          >
            {{ ctas.getStarted.label }}
          </Button>
        </div>
      </article>

      <article
        id="builder"
        class="group/builder bg-transparency-white-t4 relative flex scroll-mt-24 flex-col rounded-4xl border border-white/10 p-6 transition-colors hover:border-white/25 lg:scroll-mt-36 lg:p-10"
      >
        <a
          :href="routes.platformBuilder"
          :aria-label="t('platform.products.builder.title', locale)"
          class="absolute inset-0 rounded-4xl"
        ></a>
        <h3 class="text-lg font-normal text-primary-warm-white lg:text-xl">
          {{ t('platform.products.builder.title', locale) }}
        </h3>
        <p class="mt-3 text-sm/relaxed font-light text-primary-comfy-canvas">
          {{ t('platform.products.builder.description', locale) }}
        </p>
        <div class="mt-6 flex-1">
          <BuilderVisual />
        </div>
        <div
          class="relative z-10 mt-auto flex w-fit flex-wrap items-center gap-3 pt-8"
        >
          <Button
            as="a"
            :href="externalLinks.platformBuilds"
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            {{ ctas.getStarted.label }}
          </Button>
          <Button as="a" :href="routes.enterprise" variant="link">
            {{ t('platform.products.builder.enterpriseCta', locale) }}
          </Button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import ProductHeroBadge from '../../components/common/ProductHeroBadge.vue'
import { brandButtonVariants } from '../../components/common/brandButton.variants'
import Badge from '../../components/ui/badge/Badge.vue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BuilderVisual from './BuilderVisual.vue'
import CodeTabs from './CodeTabs.vue'
import { modelsApiCodeTabs } from './codeSamples'
import ServerlessIsometricStudy from './ServerlessIsometricStudy.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const modelsTabs = modelsApiCodeTabs
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <!-- Comfy API: the headline product, full width -->
    <article
      id="serverless"
      class="group bg-transparency-white-t4 relative grid scroll-mt-24 grid-cols-1 items-center gap-8 rounded-4xl border border-transparent p-6 transition-colors hover:border-white/25 lg:scroll-mt-36 lg:grid-cols-2 lg:gap-12 lg:p-10"
    >
      <a
        :href="routes.platformComfyApi"
        :aria-label="t('platform.products.serverless.title', locale)"
        class="absolute inset-0 z-0 rounded-4xl"
      ></a>
      <div class="pointer-events-none relative z-10">
        <h3
          class="flex items-center gap-2.5 text-lg font-normal text-primary-warm-white lg:text-xl"
        >
          <span class="sr-only">
            {{ t('platform.products.serverless.title', locale) }}
          </span>
          <ProductHeroBadge
            :text="t('platform.products.serverless.badgeLabel', locale)"
            compact
            :show-connector="false"
            aria-hidden="true"
          />
          <Badge variant="accent" size="xs">
            {{ t('nav.badgeBeta', locale) }}
          </Badge>
        </h3>
        <p class="mt-3 text-sm/relaxed font-light text-primary-comfy-canvas">
          {{ t('platform.products.serverless.description', locale) }}
        </p>
        <div class="mt-8">
          <span :class="brandButtonVariants({ variant: 'solid', size: 'sm' })">
            <span class="ppformula-text-center uppercase">
              {{ t('platform.hero.getStarted', locale) }}
            </span>
          </span>
        </div>
      </div>
      <ServerlessIsometricStudy
        class="pointer-events-none relative z-10"
        :locale
      />
    </article>

    <!-- Comfy Router and Builder, side by side -->
    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <article
        id="models"
        class="group bg-transparency-white-t4 relative flex scroll-mt-24 flex-col rounded-4xl border border-transparent p-6 transition-colors hover:border-white/25 lg:scroll-mt-36 lg:p-10"
      >
        <a
          :href="routes.platformModels"
          :aria-label="t('platform.products.models.title', locale)"
          class="absolute inset-0 z-0 rounded-4xl"
        ></a>
        <h3 class="sr-only">
          {{ t('platform.products.models.title', locale) }}
        </h3>
        <div
          class="pointer-events-none relative z-10 flex w-fit items-center gap-2"
          aria-hidden="true"
        >
          <ProductHeroBadge
            :text="t('platform.products.models.title', locale).toUpperCase()"
            :show-logo="false"
            compact
          />
          <Badge variant="accent" size="xs">
            {{ t('nav.badgeComingSoon', locale) }}
          </Badge>
        </div>
        <p
          class="pointer-events-none relative z-10 mt-3 text-sm/relaxed font-light text-primary-comfy-canvas"
        >
          {{ t('platform.products.models.description', locale) }}
        </p>
        <div class="relative z-10 mt-6">
          <CodeTabs
            :tabs="modelsTabs"
            :label="t('platform.products.models.title', locale)"
          />
        </div>
        <div class="pointer-events-none relative z-10 mt-auto self-start pt-6">
          <span :class="brandButtonVariants({ variant: 'solid', size: 'sm' })">
            <span class="ppformula-text-center uppercase">
              {{ t('platform.products.models.learnMore', locale) }}
            </span>
          </span>
        </div>
      </article>

      <article
        id="builder"
        class="group/builder bg-transparency-white-t4 relative flex scroll-mt-24 flex-col rounded-4xl border border-transparent p-6 transition-colors hover:border-white/25 lg:scroll-mt-36 lg:p-10"
      >
        <a
          :href="routes.platformBuilder"
          :aria-label="t('platform.products.builder.title', locale)"
          class="absolute inset-0 rounded-4xl"
        ></a>
        <h3 class="sr-only">
          {{ t('platform.products.builder.title', locale) }}
        </h3>
        <ProductHeroBadge
          :text="t('platform.products.builder.title', locale).toUpperCase()"
          :show-logo="false"
          compact
          aria-hidden="true"
        />
        <p class="mt-3 text-sm/relaxed font-light text-primary-comfy-canvas">
          {{ t('platform.products.builder.description', locale) }}
        </p>
        <div class="mt-6 flex-1">
          <BuilderVisual />
        </div>
        <div class="pointer-events-none relative z-10 mt-auto self-start pt-6">
          <span :class="brandButtonVariants({ variant: 'solid', size: 'sm' })">
            <span class="ppformula-text-center uppercase">
              {{ t('platform.hero.getStarted', locale) }}
            </span>
          </span>
        </div>
      </article>
    </div>
  </section>
</template>

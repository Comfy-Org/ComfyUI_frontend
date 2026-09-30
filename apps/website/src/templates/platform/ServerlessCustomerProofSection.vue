<script setup lang="ts">
import Button from '../../components/ui/button/Button.vue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/site'
import { t } from '../../i18n/site'

const { locale = 'en', showCustomerProof = false } = defineProps<{
  locale?: Locale
  showCustomerProof?: boolean
}>()
</script>

<template>
  <section
    class="mx-auto grid max-w-9xl grid-cols-1 items-center gap-8 px-6 py-10 lg:grid-cols-2 lg:gap-14 lg:py-14"
  >
    <div>
      <p
        class="text-xs font-bold tracking-widest text-primary-comfy-yellow uppercase"
      >
        {{ t('platform.serverlessApps.eyebrow', {}, { locale }) }}
      </p>
      <h2
        class="mt-4 max-w-xl text-2xl font-light text-balance text-primary-comfy-canvas lg:text-3xl"
      >
        {{ t('platform.serverlessApps.heading', {}, { locale }) }}
      </h2>
      <p class="mt-4 max-w-xl text-sm/relaxed text-smoke-700">
        {{ t('platform.serverlessApps.body', {}, { locale }) }}
      </p>
      <Button
        as="a"
        :href="getRoutes(locale).hubApps"
        variant="default"
        class="mt-7 font-bold"
      >
        {{ t('platform.serverlessApps.browseApps', {}, { locale }) }}
      </Button>
    </div>

    <div
      class="overflow-hidden rounded-4xl border border-white/10 bg-primary-comfy-ink-light shadow-2xl shadow-black/20"
    >
      <video
        :aria-label="t('platform.serverlessApps.videoLabel', {}, { locale })"
        class="block size-full object-cover"
        controls
        loop
        playsinline
        preload="metadata"
      >
        <source
          src="https://media.comfy.org/website/comfy-api/app-serverless.mp4"
          type="video/mp4"
        />
      </video>
    </div>
  </section>

  <section
    v-if="showCustomerProof"
    class="mx-auto max-w-9xl px-6 py-10 lg:py-14"
  >
    <a
      href="/customers/svedka-silverside/"
      :aria-label="
        t('platform.serverlessCaseStudy.linkLabel', {}, { locale })
      "
      class="mx-auto flex w-full shrink-0 snap-start flex-col justify-between rounded-3xl bg-transparency-white-t4 p-8 lg:w-3/4 lg:p-12"
    >
      <blockquote class="text-2xl/relaxed font-light text-primary-comfy-canvas">
        <span aria-hidden="true">“</span>
        <span>{{ t('platform.serverlessCaseStudy.quote', {}, { locale }) }}</span>
        <span aria-hidden="true">”</span>
      </blockquote>
      <cite class="mt-12 not-italic">
        <span class="block text-base font-medium text-primary-comfy-yellow">
          {{ t('platform.serverlessCaseStudy.name', {}, { locale }) }},
        </span>
        <span class="block text-base font-medium text-primary-comfy-yellow">
          {{ t('platform.serverlessCaseStudy.role', {}, { locale }) }}
        </span>
      </cite>
    </a>
  </section>
</template>

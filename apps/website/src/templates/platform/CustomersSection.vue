<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import Button from '../../components/ui/button/Button.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { resolveRel } from '../../utils/cta'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

interface TierCta {
  label: string
  href: string
  target?: '_blank'
}

interface Tier {
  id: string
  title: string
  description: string
  cta: TierCta
}

const tiers: Tier[] = [
  {
    id: 'solo',
    title: t('platform.customers.solo.title', locale),
    description: t('platform.customers.solo.description', locale),
    cta: {
      label: t('platform.customers.solo.cta', locale),
      href: externalLinks.platform,
      target: '_blank'
    }
  },
  {
    id: 'studio',
    title: t('platform.customers.studio.title', locale),
    description: t('platform.customers.studio.description', locale),
    cta: {
      label: t('platform.customers.studio.cta', locale),
      href: routes.customers
    }
  },
  {
    id: 'enterprise',
    title: t('platform.customers.enterprise.title', locale),
    description: t('platform.customers.enterprise.description', locale),
    cta: {
      label: t('platform.customers.enterprise.cta', locale),
      href: routes.contact
    }
  }
]
</script>

<template>
  <section
    id="customers"
    class="max-w-9xl mx-auto scroll-mt-24 px-6 py-10 lg:scroll-mt-36 lg:py-14"
  >
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.customers.heading', locale) }}
    </SectionHeader>

    <figure class="mx-auto mt-8 max-w-2xl text-center">
      <blockquote
        class="text-base/relaxed font-light text-primary-warm-white lg:text-lg/relaxed"
      >
        {{ t('platform.customers.quote', locale) }}
      </blockquote>
      <figcaption class="mt-3 text-xs text-smoke-700">
        {{ t('platform.customers.quoteAttribution', locale) }}
      </figcaption>
    </figure>

    <div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3 lg:mt-10">
      <article
        v-for="tier in tiers"
        :key="tier.id"
        class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
      >
        <h3 class="text-base font-normal text-primary-warm-white lg:text-lg">
          {{ tier.title }}
        </h3>
        <p class="mt-3 text-xs/relaxed font-light text-primary-comfy-canvas">
          {{ tier.description }}
        </p>
        <div class="mt-auto pt-6">
          <Button
            as="a"
            :href="tier.cta.href"
            :target="tier.cta.target"
            :rel="resolveRel(tier.cta)"
            variant="outline"
          >
            {{ tier.cta.label }}
          </Button>
        </div>
      </article>
    </div>
  </section>
</template>

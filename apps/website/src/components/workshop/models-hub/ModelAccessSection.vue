<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import BrandButton from '@/components/common/BrandButton.vue'
import { apiKeysLink, externalLinks, getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

type AccessLink = {
  label: string
  href: string
  external?: boolean
  testId?: string
}

const cards: {
  title: string
  body: string
  surface: string
  links: AccessLink[]
  testId: string
}[] = [
  {
    title: t('workshop.modelsHub.access.openTitle'),
    body: t('workshop.modelsHub.access.openBody'),
    surface: 'bg-primary-comfy-plum',
    links: [
      {
        label: t('workshop.modelsHub.access.openCta'),
        href: getRoutes(locale).models,
        testId: 'model-access-open'
      }
    ],
    testId: 'model-access-open-card'
  },
  {
    title: t('workshop.modelsHub.access.partnerTitle'),
    body: t('workshop.modelsHub.access.partnerBody'),
    surface: 'bg-transparency-white-t8',
    links: [
      {
        label: t('workshop.modelsHub.getApiKey'),
        href: apiKeysLink({ onboarding: 'router' })
      },
      {
        label: t('workshop.modelsHub.access.apiDocs'),
        href: externalLinks.docsComfyRouter,
        external: true
      }
    ],
    testId: 'model-access-partner'
  }
]
</script>

<template>
  <section
    aria-labelledby="model-access-heading"
    class="grid gap-5 md:grid-cols-2"
    data-testid="model-access"
  >
    <h2 id="model-access-heading" class="sr-only">
      {{ t('workshop.modelsHub.access.heading') }}
    </h2>
    <div
      v-for="card in cards"
      :key="card.testId"
      :class="
        cn('flex flex-col justify-between rounded-4.5xl p-8', card.surface)
      "
      :data-testid="card.testId"
    >
      <h3 class="text-3xl font-light text-white lg:text-4xl">
        {{ card.title }}
      </h3>
      <div class="mt-auto pt-16">
        <p class="text-sm text-white/70">
          {{ card.body }}
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <BrandButton
            v-for="(link, index) in card.links"
            :key="link.href"
            :href="link.href"
            :target="link.external ? '_blank' : undefined"
            :variant="index === 0 ? 'solid' : 'outline'"
            size="nav"
            class="uppercase"
            :data-testid="link.testId"
          >
            {{ link.label }}
          </BrandButton>
        </div>
      </div>
    </div>
  </section>
</template>

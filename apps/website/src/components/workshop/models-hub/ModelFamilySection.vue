<script setup lang="ts">
import { computed } from 'vue'

import BrandButton from '@/components/common/BrandButton.vue'
import SectionLabel from '@/components/common/SectionLabel.vue'
import WorkshopCardMedia from '@/components/workshop/WorkshopCardMedia.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import { catalogSearch } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { OPEN_WEIGHT_MODELS } from '@/lib/workshop/explorer/open-weight-models'
import { familyShowcase } from '@/lib/workshop/models-hub'

const FAMILY = 'Wan'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const catalogue = getRoutes(locale).workshop
const searchHref = (query: string) => `${catalogue}${catalogSearch({ query })}`
const openWeightsHref = getRoutes(locale).models
const family = computed(() =>
  familyShowcase(FAMILY, models, OPEN_WEIGHT_MODELS)
)
const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors outline-none hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
</script>

<template>
  <section
    v-if="family"
    aria-labelledby="model-family-heading"
    class="flex flex-col gap-5"
    data-testid="model-family"
  >
    <div>
      <SectionLabel>{{ t('workshop.modelsHub.family.eyebrow') }}</SectionLabel>
      <h2
        id="model-family-heading"
        class="mt-2 text-3xl font-light text-primary-comfy-canvas"
      >
        {{ t('workshop.modelsHub.family.title') }}
      </h2>
    </div>
    <div
      class="grid items-center gap-8 overflow-hidden rounded-4xl bg-hub-surface p-2 md:grid-cols-2"
    >
      <div
        class="relative aspect-16/10 overflow-hidden rounded-3xl bg-hub-surface-hover"
      >
        <WorkshopCardMedia v-if="family.cover" :model="family.cover" />
      </div>
      <div class="flex flex-col items-start gap-4 p-6">
        <h3 class="text-2xl text-primary-warm-white">
          {{ t('workshop.modelsHub.family.wanTitle') }}
        </h3>
        <p class="text-sm text-content-secondary">
          {{ t('workshop.modelsHub.family.wanDescription') }}
        </p>
        <BrandButton
          :href="searchHref(FAMILY)"
          variant="solid"
          size="nav"
          class="uppercase"
          data-testid="model-family-explore"
        >
          {{ t('workshop.modelsHub.family.wanExplore') }}
        </BrandButton>
        <ul
          class="flex flex-wrap gap-2"
          :aria-label="
            t('workshop.modelsHub.family.versionsLabel', { name: FAMILY })
          "
        >
          <li
            v-for="release in family.releases"
            :key="`${release.open}:${release.version}`"
          >
            <a
              :href="release.open ? openWeightsHref : searchHref(release.query)"
              :class="pillClass"
            >
              {{
                release.open
                  ? t('workshop.modelsHub.family.openVersion', {
                      name: `${FAMILY} ${release.version}`
                    })
                  : `${FAMILY} ${release.version}`
              }}
            </a>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

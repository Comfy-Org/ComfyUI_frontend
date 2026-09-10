<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed, ref } from 'vue'

import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import { groupModels } from '../../config/model-family'
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import HubBrowse from '../hub/HubBrowse.vue'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const { version } = usePrototypeTweaks()

// Inside a category the category is the heading, so the page's own hero would
// be a second title above it.
const inSection = ref(false)

// Only the browsing rows hide the rest of the catalogue behind a category, so
// only they need a way through to all of it.
const browseAll = ref(false)
const offersBrowseAll = computed(() => version.value === 'v1.1')
const total = computed(() => groupModels(models).length)
</script>

<template>
  <HubBrowse v-if="version === 'v2'" :locale />
  <template v-else>
    <WorkshopHero
      v-if="!inSection"
      subtitle-key="workshop.hero.subtitle"
      :locale
    >
      <template #aside>
        <button
          v-if="offersBrowseAll"
          type="button"
          class="group hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-transparency-white-t20 px-5 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none focus-visible:ring-3 max-sm:w-full max-sm:justify-center"
          data-testid="browse-all"
          @click="browseAll = true"
        >
          {{ t('workshop.sections.browseAll', locale) }}
          <span class="text-primary-warm-gray tabular-nums">{{ total }}</span>
          <ChevronRight
            class="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </template>
    </WorkshopHero>
    <WorkshopModelsGrid
      v-model:browse-all="browseAll"
      :models
      :locale
      @section="inSection = $event"
    />
  </template>
</template>

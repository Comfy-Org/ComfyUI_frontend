<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { computed, watch } from 'vue'

import WorkshopGate from '@/components/workshop/WorkshopGate.vue'
import type { AppWorkshopModel } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopAppsEnabled,
  useWorkshopEnabled
} from '@/scripts/posthog'
import { isWorkshopModelShown } from '@/scripts/workshop-model-flags'
import OpenjutsuStudio from './OpenjutsuStudio.vue'

const { model, locale = 'en' } = defineProps<{
  model: AppWorkshopModel
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const hubHref = getRoutes(locale).hubApps
const appsEnabled = useWorkshopAppsEnabled()
const workshopEnabled = useWorkshopEnabled()
const mounted = useMounted()
const allowed = computed(() => appsEnabled.value && isWorkshopModelShown(model))

watch(
  () => mounted.value && workshopEnabled.value && allowed.value,
  (shown) => {
    if (!shown) return
    captureWorkshopEvent({
      name: 'model_viewed',
      properties: {
        model_slug: model.slug,
        page_type: 'app',
        app_slug: model.slug
      }
    })
  },
  { once: true }
)
</script>

<template>
  <WorkshopGate :allowed>
    <OpenjutsuStudio :locale />
    <template #fallback>
      <div
        class="flex min-h-[60svh] flex-col items-center justify-center gap-3 text-center"
      >
        <p class="text-base font-semibold text-primary-warm-white">
          {{ t('openjutsu.closed') }}
        </p>
        <a
          :href="hubHref"
          class="text-sm text-primary-comfy-yellow underline underline-offset-4"
        >
          {{ t('cinematic.backToApps') }}
        </a>
      </div>
    </template>
  </WorkshopGate>
</template>

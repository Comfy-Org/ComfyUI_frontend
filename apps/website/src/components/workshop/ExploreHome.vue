<script setup lang="ts">
import { computed } from 'vue'

import type {
  AppWorkshopModel,
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { ac } from '@/lib/workshop/catalogue-apps'
import { doorArt } from '@/lib/workshop/explore-art'
import { isWorkshopModelShown } from '@/scripts/workshop-model-flags'
import ExploreDoors from './ExploreDoors.vue'

const {
  models,
  appsShown,
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  appsShown: boolean
  locale?: Locale
}>()

const shown = computed(() => models.filter(isWorkshopModelShown))
const routerModels = computed(() =>
  shown.value.filter((model) => model.routerId !== undefined)
)
const workflows = computed(() =>
  shown.value.filter(
    (model): model is WorkflowWorkshopModel =>
      model.type === 'CLOUD' || model.type === 'SERVERLESS'
  )
)
const apps = computed<readonly CatalogueApp[]>(() =>
  appsShown
    ? shown.value
        .filter((model): model is AppWorkshopModel => model.type === 'APP')
        .map((app) => ({
          key: app.slug,
          name: app.name,
          task: ac(
            app.appId === 'studio' ? 'studioTask' : 'reshootTask',
            locale
          ),
          href: app.href,
          thumbnail: app.thumbnail
        }))
    : []
)

const art = computed(() =>
  doorArt(
    {
      models: routerModels.value,
      workflows: workflows.value,
      apps: apps.value
    },
    locale
  )
)
const counts = computed(() => ({
  models: routerModels.value.length,
  workflows: workflows.value.length,
  apps: apps.value.length
}))
</script>

<template>
  <div class="mt-2 flex flex-col gap-14" data-testid="explore-home">
    <ExploreDoors :counts :art :locale />
  </div>
</template>

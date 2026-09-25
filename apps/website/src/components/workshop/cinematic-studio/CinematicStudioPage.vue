<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { rc } from '../../../lib/workshop/cinematic-studio/reshoot-copy'
import WorkshopGate from '../WorkshopGate.vue'
import CinematicAppsHub from './CinematicAppsHub.vue'
import CinematicScenarioMenu from './CinematicScenarioMenu.vue'
import CinematicStudio from './CinematicStudio.vue'
import CinematicStudioPanel from './CinematicStudioPanel.vue'
import ReshootStudio from './reshoot/ReshootStudio.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly CinematicModel[]
  locale?: Locale
}>()

const LAYOUTS = [
  { id: 'e', label: 'cinematic.ux.composer' },
  { id: 'd', label: 'cinematic.ux.panel' },
  { id: 'hub', label: 'cinematic.ux.hub' }
] as const

const APPS = ['studio', 'reshoot'] as const

const layout = ref('e')
const app = ref('studio')
const layoutOptions = computed(() =>
  LAYOUTS.map((option) => ({ id: option.id, label: tc(option.label, locale) }))
)
const appOptions = computed(() => [
  { id: 'studio', label: tc('cinematic.title', locale) },
  { id: 'reshoot', label: rc('reshoot.title', locale) }
])

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const requestedLayout = params.get('ux')
  if (LAYOUTS.some((option) => option.id === requestedLayout))
    layout.value = requestedLayout ?? layout.value
  const requestedApp = params.get('app')
  if (APPS.some((id) => id === requestedApp))
    app.value = requestedApp ?? app.value
})

function remember(key: string, value: string) {
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(window.history.state, '', url)
}

function pickLayout(id: string) {
  layout.value = id
  remember('ux', id)
}

function pickApp(id: string) {
  app.value = id
  remember('app', id)
  if (layout.value === 'hub') pickLayout('e')
}
</script>

<template>
  <WorkshopGate>
    <CinematicAppsHub v-if="layout === 'hub'" :locale />
    <ReshootStudio v-else-if="app === 'reshoot'" :locale />
    <CinematicStudioPanel v-else-if="layout === 'd'" :models :locale />
    <CinematicStudio v-else :models :locale />
    <CinematicScenarioMenu
      :app
      :layout
      :apps="appOptions"
      :layouts="layoutOptions"
      :app-heading="tc('cinematic.ux.app', locale)"
      :layout-heading="tc('cinematic.ux.heading', locale)"
      @update:app="pickApp"
      @update:layout="pickLayout"
    />
    <template #fallback>
      <div
        class="flex min-h-[60svh] flex-col items-center justify-center gap-3 text-center"
      >
        <p class="text-base font-semibold text-primary-warm-white">
          {{ tc('cinematic.unavailable.title', locale) }}
        </p>
        <a
          href="/models/"
          class="text-sm text-primary-comfy-yellow underline underline-offset-4"
        >
          {{ tc('cinematic.unavailable.link', locale) }}
        </a>
      </div>
    </template>
  </WorkshopGate>
</template>

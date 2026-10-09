<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { WORKSHOP_DEPLOY_ENV } from 'astro:env/client'
import { useMounted } from '@vueuse/core'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch
} from 'vue'

import { provideStudioSwitchGuard } from '@/composables/useStudioSwitchGuard'
import type { AppWorkshopModel } from '@/config/models-catalogue'
import type { WorkshopAppId } from '@/lib/workshop/apps'
import { workshopAppHref } from '@/lib/workshop/apps'
import { getRoutes } from '@/config/routes'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import type { Locale } from '@/i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopAppsEnabled,
  useWorkshopEnabled
} from '@/scripts/posthog'
import RunLeaveDialog from '@/components/workshop/RunLeaveDialog.vue'
import WorkshopGate from '@/components/workshop/WorkshopGate.vue'
import CinematicAppsHub from './CinematicAppsHub.vue'
import CinematicScenarioMenu from './CinematicScenarioMenu.vue'
import CinematicStudio from './CinematicStudio.vue'
import CinematicStudioPanel from './CinematicStudioPanel.vue'
import MoveAnythingStudio from '@/components/workshop/move-anything/MoveAnythingStudio.vue'
import RelightStudio from '@/components/workshop/relight/RelightStudio.vue'
import ReshootStudio from './reshoot/ReshootStudio.vue'
import { mc } from '@/lib/workshop/move-anything/copy'
import { lc } from '@/lib/workshop/relight/copy'
import { isWorkshopModelShown } from '@/scripts/workshop-model-flags'

const {
  apps,
  models,
  initialApp = 'studio',
  locale = 'en'
} = defineProps<{
  apps: readonly AppWorkshopModel[]
  models: readonly CinematicModel[]
  initialApp?: WorkshopAppId
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const workshopHref = getRoutes(locale).workshop

const LAYOUTS = [
  { id: 'e', label: 'cinematic.ux.composer' },
  { id: 'd', label: 'cinematic.ux.panel' },
  { id: 'hub', label: 'cinematic.ux.hub' }
] as const

const APPS = ['studio', 'reshoot', 'move-anything', 'relight'] as const
const EDITOR_APPS: readonly WorkshopAppId[] = ['move-anything', 'relight']
const reviewing = WORKSHOP_DEPLOY_ENV !== 'production'

const appsEnabled = useWorkshopAppsEnabled()
const layout = ref('d')
const app = ref<WorkshopAppId>(initialApp)
const shownApps = computed(() =>
  apps.filter((candidate) => isWorkshopModelShown(candidate))
)
const studioEnabled = computed(
  () =>
    appsEnabled.value &&
    shownApps.value.some((candidate) => candidate.appId === app.value)
)
const workshopEnabled = useWorkshopEnabled()
const mounted = useMounted()
const viewedApps = new Set<WorkshopAppId>()
watch(
  () =>
    mounted.value && workshopEnabled.value && studioEnabled.value
      ? app.value
      : undefined,
  (shown) => {
    const model = apps.find((candidate) => candidate.appId === shown)
    if (!shown || !model || viewedApps.has(shown)) return
    viewedApps.add(shown)
    captureWorkshopEvent({
      name: 'model_viewed',
      properties: {
        model_slug: model.slug,
        page_type: 'app',
        app_slug: model.slug
      }
    })
  }
)
const editorShown = computed(
  () =>
    mounted.value &&
    workshopEnabled.value &&
    studioEnabled.value &&
    layout.value !== 'hub' &&
    EDITOR_APPS.includes(app.value)
)
watch(editorShown, (shown) =>
  document.documentElement.toggleAttribute('data-workshop-editor', shown)
)
onBeforeUnmount(() =>
  document.documentElement.removeAttribute('data-workshop-editor')
)
const layoutOptions = computed(() =>
  LAYOUTS.map((option) => ({
    id: option.id,
    label: t(option.label)
  }))
)
const appOptions = computed(() =>
  [
    {
      id: 'studio',
      label: t('cinematic.title')
    },
    {
      id: 'reshoot',
      label: t('reshoot.title')
    },
    {
      id: 'move-anything',
      label: mc('move.title', locale)
    },
    {
      id: 'relight',
      label: lc('relight.title', locale)
    }
  ].filter((option) =>
    shownApps.value.some((candidate) => candidate.appId === option.id)
  )
)

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const requestedLayout = params.get('ux')
  if (reviewing && LAYOUTS.some((option) => option.id === requestedLayout))
    layout.value = requestedLayout ?? layout.value
  const requestedApp = APPS.find((id) => id === params.get('app'))
  if (requestedApp) showApp(requestedApp)
})

function showApp(id: WorkshopAppId) {
  app.value = id
  const name = appOptions.value.find((option) => option.id === id)?.label
  if (name) document.title = `${name} - Comfy`
  const url = new URL(window.location.href)
  url.pathname = workshopAppHref(id, locale)
  url.searchParams.delete('app')
  window.history.replaceState(window.history.state, '', url)
}

function remember(key: string, value: string) {
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(window.history.state, '', url)
}

const busy = provideStudioSwitchGuard()
const pendingSwitch = shallowRef<() => void>()

function guarded(change: () => void) {
  if (busy()) pendingSwitch.value = change
  else change()
}

function switchAnyway() {
  const change = pendingSwitch.value
  pendingSwitch.value = undefined
  change?.()
}

function setLayout(id: string) {
  layout.value = id
  remember('ux', id)
}

function pickLayout(id: string) {
  guarded(() => setLayout(id))
}

function pickApp(id: string) {
  const picked = APPS.find((known) => known === id)
  if (!picked) return
  guarded(() => {
    showApp(picked)
    if (layout.value === 'hub') setLayout('d')
  })
}
</script>

<template>
  <WorkshopGate :allowed="studioEnabled">
    <CinematicAppsHub v-if="layout === 'hub'" :models="shownApps" :locale />
    <ReshootStudio v-else-if="app === 'reshoot'" :locale />
    <MoveAnythingStudio v-else-if="app === 'move-anything'" :layout :locale />
    <RelightStudio v-else-if="app === 'relight'" :layout :locale />
    <CinematicStudioPanel
      v-else-if="layout === 'd'"
      :models
      :show-credits="false"
      :locale
    />
    <CinematicStudio v-else :models :show-credits="false" :locale />
    <CinematicScenarioMenu
      v-if="reviewing"
      :app
      :layout
      :editor="editorShown"
      :apps="appOptions"
      :layouts="layoutOptions"
      :app-heading="t('cinematic.ux.app')"
      :layout-heading="t('cinematic.ux.heading')"
      @update:app="pickApp"
      @update:layout="pickLayout"
    />
    <RunLeaveDialog
      :open="pendingSwitch !== undefined"
      :locale
      @update:open="(value: boolean) => !value && (pendingSwitch = undefined)"
      @leave="switchAnyway"
    />
    <template #fallback>
      <div
        class="flex min-h-[60svh] flex-col items-center justify-center gap-3 text-center"
      >
        <p class="text-base font-semibold text-primary-warm-white">
          {{ t('cinematic.unavailable.title') }}
        </p>
        <a
          :href="workshopHref"
          class="text-sm text-primary-comfy-yellow underline underline-offset-4"
        >
          {{ t('cinematic.unavailable.link') }}
        </a>
      </div>
    </template>
  </WorkshopGate>
</template>

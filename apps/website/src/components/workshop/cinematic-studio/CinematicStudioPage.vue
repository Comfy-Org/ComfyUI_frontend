<script setup lang="ts">
import { Ellipsis } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import WorkshopGate from '../WorkshopGate.vue'
import CinematicAppsHub from './CinematicAppsHub.vue'
import CinematicMenu from './CinematicMenu.vue'
import CinematicStudio from './CinematicStudio.vue'
import CinematicStudioPanel from './CinematicStudioPanel.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly CinematicModel[]
  locale?: Locale
}>()

const LAYOUTS = [
  { id: 'e', label: 'cinematic.ux.composer' },
  { id: 'd', label: 'cinematic.ux.panel' },
  { id: 'hub', label: 'cinematic.ux.hub' }
] as const

const layout = ref('e')
const layoutOptions = computed(() =>
  LAYOUTS.map((option) => ({ id: option.id, label: tc(option.label, locale) }))
)

onMounted(() => {
  const requested = new URLSearchParams(window.location.search).get('ux')
  if (requested && LAYOUTS.some((option) => option.id === requested))
    layout.value = requested
})

function pickLayout(id: string) {
  layout.value = id
  const url = new URL(window.location.href)
  url.searchParams.set('ux', id)
  window.history.replaceState(window.history.state, '', url)
}
</script>

<template>
  <WorkshopGate>
    <CinematicAppsHub v-if="layout === 'hub'" :locale />
    <CinematicStudioPanel v-else-if="layout === 'd'" :models :locale />
    <CinematicStudio v-else :models :locale />
    <CinematicMenu
      :model-value="layout"
      :options="layoutOptions"
      :heading="tc('cinematic.ux.heading', locale)"
      trigger-class="fixed right-3 bottom-56 z-40 size-8 justify-center rounded-full border border-transparency-white-t20 bg-primary-comfy-ink-light text-primary-comfy-canvas shadow-lg hover:text-primary-warm-white lg:right-5 lg:bottom-5"
      @update:model-value="pickLayout"
    >
      <Ellipsis class="size-4" aria-hidden="true" />
    </CinematicMenu>
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

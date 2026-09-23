<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useCinematicStudioRun } from '../../../composables/useCinematicStudioRun'
import { useTablist } from '../../../composables/useTablist'
import { resolveModelRouterRender } from '../../../config/router-render'
import type {
  AspectRatio,
  CinematicModel,
  Direction,
  DirectionPart,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import {
  DEFAULT_DIRECTION,
  RESOLUTIONS,
  cameraGroups,
  gradeGroup,
  lookGroups
} from '../../../lib/workshop/cinematic-studio/catalog'
import {
  cinematicPrompt,
  cinematicPromptSegments
} from '../../../lib/workshop/cinematic-studio/prompt'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import ApiTab from '../ApiTab.vue'
import CinematicPanel from './CinematicPanel.vue'
import type { PickerKey } from './CinematicPanel.vue'
import CinematicPicker from './CinematicPicker.vue'
import CinematicStage from './CinematicStage.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly CinematicModel[]
  locale?: Locale
}>()

const studio = useCinematicStudioRun()

const modelSlug = ref(models[0].slug)
const scene = ref('')
const enhance = ref(true)
const direction = ref<Direction>(DEFAULT_DIRECTION)
const aspect = ref<AspectRatio>('21:9')
const resolution = ref<Resolution>('2K')
const takes = ref(1)
const cast = shallowRef<File>()
const palette = shallowRef<File>()
const picker = ref<PickerKey>()

const brief = computed(() => ({
  scene: scene.value,
  direction: direction.value,
  enhance: enhance.value,
  cast: !!cast.value,
  palette: !!palette.value
}))
const promptSegments = computed(() => cinematicPromptSegments(brief.value))
const prompt = computed(() => cinematicPrompt(brief.value))
const resolutionPixels = computed(
  () => RESOLUTIONS.find((option) => option.id === resolution.value)?.pixels
)

const pickerGroups = computed(() => {
  if (picker.value === 'camera') return cameraGroups
  if (picker.value === 'grade') return [gradeGroup]
  return lookGroups.filter((group) => group.part === picker.value)
})
const pickerTitle = computed(() =>
  picker.value === 'camera'
    ? t('cinematic.section.camera', locale)
    : pickerGroups.value[0]
      ? t(pickerGroups.value[0].title, locale)
      : ''
)

function togglePicker(key: PickerKey) {
  picker.value = picker.value === key ? undefined : key
}

function choose(part: DirectionPart, id: string) {
  direction.value = { ...direction.value, [part]: id }
}

function generate() {
  picker.value = undefined
  void studio.generate({
    modelSlug: modelSlug.value,
    prompt: prompt.value,
    aspect: aspect.value,
    resolutionPixels: resolutionPixels.value ?? 2048,
    takes: takes.value,
    references: [cast.value, palette.value].filter(
      (file): file is File => !!file
    )
  })
}

type View = 'playground' | 'api'
const views: readonly View[] = ['playground', 'api']
const view = ref<View>('playground')
const { onKeydown } = useTablist(() => views, view)

const apiRequest = computedAsync(async () => {
  if (view.value !== 'api') return undefined
  const model = await studio.loadModel(modelSlug.value)
  try {
    const resolved = resolveModelRouterRender(model, {
      prompt: prompt.value || t('cinematic.scene.placeholder', locale),
      aspect_ratio: aspect.value,
      resolution: resolutionPixels.value
    })
    return {
      contract: resolved.contract,
      values: resolved.values,
      slug: model.slug
    }
  } catch {
    return { contract: model.execution, values: {}, slug: model.slug }
  }
}, undefined)
</script>

<template>
  <div
    class="flex h-[calc(100dvh-11.25rem)] min-h-[680px] flex-col overflow-hidden border-t border-transparency-white-t8 bg-primary-comfy-ink text-primary-warm-white"
  >
    <header
      class="flex h-13 shrink-0 items-center gap-7 border-b border-transparency-white-t8 px-6"
    >
      <h1 class="text-sm font-semibold">{{ t('cinematic.title', locale) }}</h1>
      <div
        role="tablist"
        :aria-label="t('cinematic.views', locale)"
        class="flex h-full gap-5"
        @keydown="onKeydown"
      >
        <button
          v-for="tab in views"
          :id="`cinematic-tab-${tab}`"
          :key="tab"
          type="button"
          role="tab"
          :aria-selected="view === tab"
          :aria-controls="`cinematic-panel-${tab}`"
          :tabindex="view === tab ? 0 : -1"
          :class="
            cn(
              'h-full text-sm',
              view === tab
                ? 'font-semibold text-primary-warm-white shadow-[inset_0_-2px_0] shadow-primary-warm-white'
                : 'text-primary-warm-gray hover:text-primary-warm-white'
            )
          "
          @click="view = tab"
        >
          {{ t(`cinematic.view.${tab}`, locale) }}
        </button>
      </div>
    </header>

    <div
      v-show="view === 'playground'"
      id="cinematic-panel-playground"
      role="tabpanel"
      aria-labelledby="cinematic-tab-playground"
      class="relative flex min-h-0 flex-1"
    >
      <CinematicPanel
        v-model:model-slug="modelSlug"
        v-model:scene="scene"
        v-model:enhance="enhance"
        v-model:direction="direction"
        v-model:aspect="aspect"
        v-model:resolution="resolution"
        v-model:takes="takes"
        v-model:cast="cast"
        v-model:palette="palette"
        :models
        :prompt-segments="promptSegments"
        :gate="studio.gate.value"
        :workspace-name="studio.session.value?.workspace.name"
        :rendering="studio.rendering.value"
        :open-picker="picker"
        :locale
        @open="togglePicker"
        @generate="generate"
        @cancel="studio.cancel"
      />
      <CinematicPicker
        v-if="picker"
        :groups="pickerGroups"
        :direction
        :title="pickerTitle"
        :locale
        class="absolute top-0 bottom-0 left-[392px] z-20"
        @choose="choose"
        @close="picker = undefined"
      />
      <CinematicStage
        :reel="studio.reel.value"
        :models
        :locale
        @select="studio.select"
      />
    </div>

    <div
      v-if="view === 'api'"
      id="cinematic-panel-api"
      role="tabpanel"
      aria-labelledby="cinematic-tab-api"
      class="flex-1 overflow-y-auto px-6 py-8"
    >
      <div class="mx-auto flex max-w-4xl flex-col gap-4">
        <p class="text-sm text-primary-comfy-canvas">
          {{ t('cinematic.api.intro', locale) }}
        </p>
        <ApiTab
          v-if="apiRequest"
          :contract="apiRequest.contract"
          :values="apiRequest.values"
          :workspace-id="studio.session.value?.workspace.id"
          :model-slug="apiRequest.slug"
          :locale
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Code } from '@lucide/vue'
import { computedAsync } from '@vueuse/core'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'

import { useCinematicStudioRun } from '../../../composables/useCinematicStudioRun'
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
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import ApiTab from '../ApiTab.vue'
import HeaderAccount from '../HeaderAccount.vue'
import CinematicPanel from './CinematicPanel.vue'
import type { PickerKey } from './picker-key'
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
const references = computed(() =>
  [cast.value, palette.value].filter((file): file is File => !!file)
)
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
    ? tc('cinematic.section.camera', locale)
    : pickerGroups.value[0]
      ? tc(pickerGroups.value[0].title, locale)
      : ''
)

let pickerOpener: HTMLElement | undefined
function togglePicker(key: PickerKey) {
  const active = document.activeElement
  if (active instanceof HTMLElement) pickerOpener = active
  picker.value = picker.value === key ? undefined : key
}
watch(picker, async (open, wasOpen) => {
  if (open || !wasOpen) return
  await nextTick()
  pickerOpener?.focus()
})

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
    references: references.value
  })
}

const apiOpen = ref(false)

const apiRequest = computedAsync(async () => {
  if (!apiOpen.value) return undefined
  const model = await studio.loadModel(modelSlug.value)
  try {
    const resolved = resolveModelRouterRender(model, {
      prompt: prompt.value || tc('cinematic.scene.placeholder', locale),
      aspect_ratio: aspect.value,
      resolution: resolutionPixels.value,
      ...(references.value.length ? { reference_images: references.value } : {})
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
  <div class="flex h-svh flex-col overflow-hidden text-primary-warm-white">
    <header
      class="flex h-12 shrink-0 items-center gap-3 border-b border-transparency-white-t8 px-4"
    >
      <a
        href="/models/"
        class="grid size-8 place-items-center rounded-lg hover:bg-transparency-white-t8"
        :aria-label="tc('cinematic.bar.home', locale)"
      >
        <img src="/icons/logo.svg" alt="" class="h-4 w-auto" />
      </a>
      <span class="h-5 w-px bg-transparency-white-t8" aria-hidden="true" />
      <h1 class="text-sm font-semibold">{{ tc('cinematic.title', locale) }}</h1>
      <span
        class="rounded-full border border-transparency-white-t20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ tc('cinematic.bar.beta', locale) }}
      </span>
      <span class="flex-1" />
      <button
        type="button"
        class="flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase hover:bg-transparency-white-t8 hover:text-primary-warm-white"
        @click="apiOpen = true"
      >
        <Code class="size-4" aria-hidden="true" />
        {{ tc('cinematic.bar.api', locale) }}
      </button>
      <HeaderAccount :locale />
    </header>

    <div class="relative flex min-h-0 flex-1">
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
        :key="picker"
        :groups="pickerGroups"
        :direction
        :title="pickerTitle"
        :locale
        class="absolute top-0 bottom-0 left-[380px] z-20"
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

    <Sheet v-model:open="apiOpen">
      <SheetContent
        side="right"
        :close-label="tc('cinematic.picker.close', locale)"
        class="w-full overflow-y-auto border-l border-transparency-white-t8 p-6 sm:max-w-2xl"
      >
        <SheetTitle class="text-lg font-semibold text-primary-warm-white">
          {{ tc('cinematic.api.title', locale) }}
        </SheetTitle>
        <SheetDescription class="text-sm text-primary-comfy-canvas">
          {{ tc('cinematic.api.intro', locale) }}
        </SheetDescription>
        <ApiTab
          v-if="apiRequest"
          :contract="apiRequest.contract"
          :values="apiRequest.values"
          :workspace-id="studio.session.value?.workspace.id"
          :model-slug="apiRequest.slug"
          :locale
        />
      </SheetContent>
    </Sheet>
  </div>
</template>

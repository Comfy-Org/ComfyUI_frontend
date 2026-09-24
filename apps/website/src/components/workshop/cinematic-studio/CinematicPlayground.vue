<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'

import { useCinematicStudioRun } from '../../../composables/useCinematicStudioRun'
import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import type {
  AspectRatio,
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
import CinematicPanel from './CinematicPanel.vue'
import type { PickerKey } from './picker-key'
import CinematicPicker from './CinematicPicker.vue'
import CinematicStage from './CinematicStage.vue'

const { model, locale = 'en' } = defineProps<{
  model: WorkshopModelDetail
  locale?: Locale
}>()

const studio = useCinematicStudioRun(model)

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
  const focusWasInPicker = !!document.activeElement?.closest(
    '[data-testid="cinematic-picker"]'
  )
  await nextTick()
  if (focusWasInPicker || document.activeElement === document.body)
    pickerOpener?.focus()
})

function choose(part: DirectionPart, id: string) {
  direction.value = { ...direction.value, [part]: id }
}

const output = useTemplateRef<HTMLElement>('output')

function generate() {
  picker.value = undefined
  void studio.generate({
    prompt: cinematicPrompt(brief.value),
    aspect: aspect.value,
    resolutionPixels:
      RESOLUTIONS.find((option) => option.id === resolution.value)?.pixels ??
      2048,
    takes: takes.value,
    references: [cast.value, palette.value].filter(
      (file): file is File => !!file
    )
  })
  output.value?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-12 lg:gap-8" data-testid="cinematic">
    <CinematicPanel
      v-model:scene="scene"
      v-model:enhance="enhance"
      v-model:direction="direction"
      v-model:aspect="aspect"
      v-model:resolution="resolution"
      v-model:takes="takes"
      v-model:cast="cast"
      v-model:palette="palette"
      :prompt-segments="promptSegments"
      :gate="studio.gate.value"
      :workspace-name="studio.session.value?.workspace.name"
      :rendering="studio.rendering.value"
      :open-picker="picker"
      :locale
      class="lg:col-span-5"
      @open="togglePicker"
      @generate="generate"
      @cancel="studio.cancel"
    />
    <div
      ref="output"
      class="relative flex min-w-0 flex-col lg:sticky lg:top-26 lg:col-span-7 lg:self-start"
    >
      <CinematicStage
        :reel="studio.reel.value"
        :model-name="model.name"
        :locale
        @select="studio.select"
      />
      <div
        v-if="picker"
        class="fixed inset-0 z-50 bg-black/60 lg:hidden"
        aria-hidden="true"
      />
      <CinematicPicker
        v-if="picker"
        :key="picker"
        :groups="pickerGroups"
        :direction
        :title="pickerTitle"
        :locale
        class="fixed inset-x-0 bottom-0 z-50 max-h-[85svh] rounded-b-none lg:absolute lg:inset-x-0 lg:top-0 lg:bottom-auto lg:z-20 lg:max-h-[calc(100svh-8rem)] lg:rounded-b-2xl"
        @choose="choose"
        @close="picker = undefined"
      />
    </div>
  </div>
</template>

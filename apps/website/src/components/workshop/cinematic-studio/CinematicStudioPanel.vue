<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { useCinematicLeaveGuard } from '../../../composables/useCinematicLeaveGuard'
import { useCinematicPopover } from '../../../composables/useCinematicPopover'
import { useCinematicShot } from '../../../composables/useCinematicShot'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import RunLeaveDialog from '../RunLeaveDialog.vue'
import AppsBackLink from './AppsBackLink.vue'
import CinematicPanel from './CinematicPanel.vue'
import CinematicPicker from './CinematicPicker.vue'
import CinematicStageCard from './CinematicStageCard.vue'
import type { PickerKey } from './picker-key'
import { pickerGroups, popoverTitle } from './picker-key'

const { models, locale = 'en' } = defineProps<{
  models: readonly CinematicModel[]
  locale?: Locale
}>()

const {
  studio,
  modelSlug,
  scene,
  enhance,
  direction,
  aspect,
  resolution,
  takes,
  cast,
  palette,
  promptSegments,
  estimate,
  choose,
  generate: generateShot
} = useCinematicShot(models)
reportStudioBusy(() => studio.rendering.value)
const { leavingTo, leave, stay } = useCinematicLeaveGuard(
  () => studio.rendering.value,
  () => studio.cancel()
)
const {
  open: picker,
  toggle: togglePicker,
  close: closePicker
} = useCinematicPopover<PickerKey>()

const output = useTemplateRef<HTMLElement>('output')

function generate() {
  closePicker()
  generateShot()
  output.value?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
}
</script>

<template>
  <div
    class="mx-auto max-w-10xl px-4 py-8 sm:px-8 lg:px-14"
    data-testid="cinematic"
  >
    <AppsBackLink :locale class="mb-3" />
    <div class="mb-6 flex items-center gap-3">
      <h1 class="text-2xl font-semibold text-primary-warm-white lg:text-3xl">
        {{ tc('cinematic.title', locale) }}
      </h1>
      <span
        class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ tc('cinematic.beta', locale) }}
      </span>
    </div>
    <div class="grid gap-6 lg:grid-cols-12 lg:gap-8">
      <CinematicPanel
        v-model:model="modelSlug"
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
        :estimate
        :credits="studio.credits.value"
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
        <CinematicStageCard
          :reel="studio.reel.value"
          :aspect
          :models
          :locale
          @select="studio.select"
          @retry="studio.retry"
        />
        <div
          v-if="picker"
          class="fixed inset-0 z-50 bg-black/60 lg:hidden"
          aria-hidden="true"
        />
        <CinematicPicker
          v-if="picker"
          :key="picker"
          :groups="pickerGroups(picker)"
          :direction
          :title="popoverTitle(picker, locale)"
          :locale
          class="fixed inset-x-0 bottom-0 z-50 max-h-[85svh] rounded-b-none lg:absolute lg:inset-x-0 lg:top-0 lg:bottom-auto lg:z-20 lg:max-h-[calc(100svh-8rem)] lg:rounded-b-2xl"
          @choose="choose"
          @close="closePicker"
        />
      </div>
    </div>
    <RunLeaveDialog
      :open="leavingTo !== undefined"
      :locale
      @update:open="(value: boolean) => !value && stay()"
      @leave="leave"
    />
  </div>
</template>

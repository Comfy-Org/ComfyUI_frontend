<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { useCinematicPopover } from '../../../composables/useCinematicPopover'
import CinematicCreativeEditor from './CinematicCreativeEditor.vue'
import CinematicSceneBuilder from './CinematicSceneBuilder.vue'
import CinematicEditDialog from './CinematicEditDialog.vue'
import CinematicLibrary from './CinematicLibrary.vue'
import Button from '../../ui/button/Button.vue'
import { libraryCopy } from '../../../lib/workshop/cinematic-studio/library-copy'
import { useCinematicShot } from '../../../composables/useCinematicShot'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicPanel from './CinematicPanel.vue'
import CinematicPicker from './CinematicPicker.vue'
import CinematicStageCard from './CinematicStageCard.vue'
import CinematicReviewDialog from './CinematicReviewDialog.vue'
import CinematicModeSwitch from './CinematicModeSwitch.vue'
import CinematicVideoControls from './CinematicVideoControls.vue'
import type { PickerKey } from './picker-key'
import { pickerGroups, popoverTitle } from './picker-key'

const {
  models,
  editingModels = [],
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  editingModels?: readonly CinematicModel[]
  locale?: Locale
}>()

const {
  studio,
  namespace,
  creative,
  creativeOpen,
  builderOpen,
  edit,
  editSource,
  closeEdit,
  reviewEdit,
  library,
  libraryOpen,
  reuse,
  restored,
  mode,
  availableModels,
  selectedModel,
  firstFrame,
  lastFrame,
  duration,
  videoResolution,
  audio,
  canReview,
  modeReel,
  animate,
  frameLoading,
  frameError,
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
  review,
  canConfirm,
  confirm,
  choose,
  generate: generateShot
} = useCinematicShot(models, editingModels)
const {
  open: picker,
  toggle: togglePicker,
  close: closePicker
} = useCinematicPopover<PickerKey>()

const output = useTemplateRef<HTMLElement>('output')

function focusScene() {
  document.getElementById('cinematic-scene')?.focus()
}

async function useAsReference(url: string, name: string) {
  const response = await fetch(url)
  cast.value = new File([await response.blob()], name, {
    type: response.headers.get('content-type') ?? 'image/png'
  })
}

function generateOn(slug: string) {
  modelSlug.value = slug
  generate()
}

function applyBuiltScene(value: string) {
  scene.value = value
  direction.value = { ...direction.value, shot: 'auto' }
}

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
    <CinematicLibrary
      v-model:open="libraryOpen"
      :models="[...models, ...editingModels]"
      :items="library.items.value"
      :urls="library.urls.value"
      :loading="library.loading.value"
      :error="library.error.value"
      :locale
      @reuse="reuse"
      @animate="animate"
      @edit="edit"
      @remove="library.remove"
      @rename="library.rename"
      @favorite="library.favorite"
      @retry="library.retry"
    />
    <div
      class="mx-auto my-3 flex w-full max-w-7xl flex-wrap items-center gap-3 px-4"
    >
      <Button
        variant="outline"
        :disabled="studio.rendering.value"
        @click="libraryOpen = true"
        >{{ libraryCopy('title', locale) }}</Button
      >
      <Button
        variant="outline"
        :disabled="studio.rendering.value"
        @click="builderOpen = true"
        >{{ libraryCopy('builder', locale) }}</Button
      >
      <Button
        variant="outline"
        :disabled="studio.rendering.value"
        @click="creativeOpen = true"
        >{{ libraryCopy('creative', locale) }}</Button
      >
      <p
        v-if="restored"
        role="status"
        class="text-xs text-primary-comfy-canvas"
      >
        {{ libraryCopy('reuseNotice', locale) }}
      </p>
      <p
        v-if="library.error.value"
        role="alert"
        class="text-xs text-primary-comfy-canvas"
      >
        {{ libraryCopy('error', locale) }}
      </p>
    </div>
    <CinematicCreativeEditor
      v-model="creative"
      v-model:open="creativeOpen"
      :mode
      :namespace="namespace ?? 'guest'"
      :locale
    />
    <CinematicSceneBuilder
      v-model:open="builderOpen"
      :scene
      :namespace="namespace ?? 'guest'"
      :locale
      @apply="applyBuiltScene"
    />
    <CinematicEditDialog
      :source="editSource"
      :models="editingModels"
      :direction
      :locale
      @close="closeEdit"
      @review="reviewEdit"
    />
    <CinematicReviewDialog
      :review
      :can-confirm="canConfirm"
      :locale
      @close="review = undefined"
      @confirm="confirm"
    />
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
    <CinematicModeSwitch
      v-model="mode"
      :disabled="studio.rendering.value || frameLoading"
      :locale
      class="mb-4 w-fit"
      @update:model-value="closePicker"
    />
    <p
      v-if="frameLoading"
      role="status"
      class="mb-3 text-sm text-primary-comfy-canvas"
    >
      {{ tc('cinematic.video.frameLoading', locale) }}
    </p>
    <p
      v-if="frameError"
      role="alert"
      class="mb-3 text-sm text-primary-comfy-canvas"
    >
      {{ tc('cinematic.video.frameError', locale) }}
    </p>
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
        :models="availableModels"
        :mode
        :can-review="canReview"
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
      >
        <template v-if="mode === 'video'" #output>
          <CinematicVideoControls
            v-model:aspect="aspect"
            v-model:duration="duration"
            v-model:resolution="videoResolution"
            v-model:audio="audio"
            v-model:first-frame="firstFrame"
            v-model:last-frame="lastFrame"
            :model="selectedModel"
            :locale
          />
        </template>
      </CinematicPanel>
      <div
        ref="output"
        class="relative flex min-w-0 flex-col lg:sticky lg:top-26 lg:col-span-7 lg:self-start"
      >
        <CinematicStageCard
          :reel="modeReel"
          :aspect
          :models="[...models, ...editingModels]"
          :locale
          @select="studio.select"
          @animate="animate"
          @edit="edit"
          @again="generate"
          @reference="useAsReference"
          @switch-model="generateOn"
          @edit-scene="focusScene"
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
  </div>
</template>

<script setup lang="ts">
import CinematicSeedControls from './CinematicSeedControls.vue'
import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import { ref, useTemplateRef } from 'vue'

import { useCinematicPopover } from '../../../composables/useCinematicPopover'
import CinematicCreativeEditor from './CinematicCreativeEditor.vue'
import CinematicSceneBuilder from './CinematicSceneBuilder.vue'
import CinematicEditDialog from './CinematicEditDialog.vue'
import CinematicLibrary from './CinematicLibrary.vue'
import CinematicAssets from './CinematicAssets.vue'
import CinematicMotionCompare from './CinematicMotionCompare.vue'
import CinematicTransition from './CinematicTransition.vue'
import CinematicCompare from './CinematicCompare.vue'
import CinematicRecipeImport from './CinematicRecipeImport.vue'
import { tcRecipe } from '../../../lib/workshop/cinematic-studio/recipe-copy'
import CinematicEnhancer from './CinematicEnhancer.vue'
import CinematicRecovery from './CinematicRecovery.vue'
import { tcEnhancement } from '../../../lib/workshop/cinematic-studio/enhancement-copy'
import { creativePrompt } from '../../../lib/workshop/cinematic-studio/creative'
import { cinematicPrompt } from '../../../lib/workshop/cinematic-studio/prompt'
import { tcAssets } from '../../../lib/workshop/cinematic-studio/assets-copy'
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
  enhancementModel,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  editingModels?: readonly CinematicModel[]
  enhancementModel?: WorkshopModelDetail
  locale?: Locale
}>()

const enhancerOpen = ref(false)
const compareOpen = ref(false)
const recipeOpen = ref(false)

const {
  studio,
  namespace,
  creative,
  creativeOpen,
  builderOpen,
  openBuilder,
  plannerSettings,
  applyBuiltScene,
  restoreError,
  assetsOpen,
  motionOpen,
  transitionOpen,
  reviewMotion,
  applyTransition,
  selectedAssets,
  assetLimitReached,
  useAsset,
  removeAsset,
  edit,
  editSource,
  closeEdit,
  reviewEdit,
  library,
  libraryOpen,
  reuse,
  importRecipe,
  restored,
  referenceSaveError,
  preparing,
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
  useAsReference,
  nextShot,
  frameLoading,
  frameError,
  modelSlug,
  scene,
  enhance,
  direction,
  aspect,
  resolution,
  takes,
  requestedSeed,
  seedBehavior,
  cast,
  palette,
  promptSegments,
  references,
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

function generateOn(slug: string) {
  modelSlug.value = slug
  generate()
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
    <CinematicMotionCompare
      v-model:open="motionOpen"
      :items="library.items.value"
      :urls="library.urls.value"
      :models
      :namespace
      :scene
      :locale
      @review="reviewMotion"
    />
    <CinematicTransition
      v-model:open="transitionOpen"
      :items="library.items.value"
      :urls="library.urls.value"
      :models
      :namespace
      :locale
      @apply="applyTransition"
    />
    <CinematicCompare
      v-model:open="compareOpen"
      :namespace
      :items="library.items.value"
      :urls="library.urls.value"
      :models="[...models, ...editingModels]"
      :locale
      :busy="studio.rendering.value || frameLoading"
      @reuse="reuse"
      @animate="animate"
    />
    <CinematicRecipeImport
      v-model:open="recipeOpen"
      :namespace
      :models
      :editing-models="editingModels"
      :locale
      @apply="importRecipe"
    />
    <CinematicRecovery
      :entries="studio.pending.value"
      :models="[...models, ...editingModels]"
      :busy="studio.rendering.value"
      :error="studio.recoveryError.value"
      :locale
      @recover="studio.recover"
      @dismiss="studio.dismissRecovery"
    />
    <CinematicEnhancer
      v-model:open="enhancerOpen"
      :model="enhancementModel"
      :namespace="namespace ?? 'guest'"
      :scene
      :mode
      :directions="
        [
          cinematicPrompt({
            scene: '',
            direction,
            enhance: false,
            cast: false,
            palette: false,
            mode
          }),
          creativePrompt(creative, mode)
        ]
          .filter(Boolean)
          .join(' ')
      "
      :locale
      @apply="scene = $event"
    />
    <CinematicAssets
      :open="assetsOpen"
      :namespace
      :creations="library.items.value"
      :locale
      @close="assetsOpen = false"
      @use="useAsset"
    />
    <CinematicLibrary
      v-model:open="libraryOpen"
      :namespace
      :models="[...models, ...editingModels]"
      :items="library.items.value"
      :urls="library.urls.value"
      :loading="library.loading.value"
      :error="library.error.value"
      :locale
      @reuse="reuse"
      @next-shot="nextShot"
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
        @click="openBuilder"
        >{{ libraryCopy('builder', locale) }}</Button
      >
      <Button
        variant="outline"
        :disabled="studio.rendering.value"
        @click="creativeOpen = true"
        >{{ libraryCopy('creative', locale) }}</Button
      >
      <Button
        variant="outline"
        :disabled="studio.rendering.value"
        @click="assetsOpen = true"
      >
        {{ tcAssets('title', locale) }}
      </Button>
      <Button
        v-if="enhancementModel"
        variant="outline"
        :disabled="studio.rendering.value || !scene.trim()"
        @click="enhancerOpen = true"
        >{{ tcEnhancement('title', locale) }}</Button
      >
      <Button
        variant="outline"
        :disabled="studio.rendering.value"
        @click="recipeOpen = true"
        >{{ tcRecipe('title', locale) }}</Button
      >
      <Button
        variant="outline"
        :disabled="library.items.value.length < 2"
        @click="compareOpen = true"
        >{{ libraryCopy('compare', locale) }}</Button
      >
      <Button
        variant="outline"
        :disabled="studio.rendering.value"
        @click="transitionOpen = true"
        >{{ libraryCopy('transition', locale) }}</Button
      >
      <Button
        variant="outline"
        :disabled="studio.rendering.value"
        @click="motionOpen = true"
        >{{ libraryCopy('motion', locale) }}</Button
      >
      <p
        v-if="assetLimitReached"
        role="status"
        class="text-xs text-primary-comfy-canvas"
      >
        {{ tcAssets('limit', locale) }}
      </p>
      <CinematicSeedControls
        v-if="selectedModel?.seed"
        v-model:seed="requestedSeed"
        v-model:behavior="seedBehavior"
        :bounds="selectedModel.seed"
        :disabled="studio.rendering.value || preparing"
        :locale
      />
      <p
        v-if="
          mode === 'image' &&
          references.length &&
          (!selectedModel?.referenceModelSlug ||
            references.length > (selectedModel.referenceMax ?? 0))
        "
        role="status"
        class="text-xs text-primary-comfy-canvas"
      >
        {{ libraryCopy('referenceUnsupported', locale) }}
      </p>
      <p
        v-if="referenceSaveError && !review"
        role="alert"
        class="text-xs text-primary-comfy-canvas"
      >
        {{ libraryCopy('referenceSaveError', locale) }}
      </p>
      <p
        v-if="restoreError"
        role="alert"
        class="text-xs text-primary-comfy-canvas"
      >
        {{ libraryCopy('restoreError', locale) }}
      </p>
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
    <div
      v-if="selectedAssets.length"
      class="mx-auto mb-3 flex w-full max-w-7xl flex-wrap items-center gap-2 px-4"
      :aria-label="tcAssets('active', locale)"
    >
      <Button
        v-for="asset in selectedAssets"
        :key="asset.id"
        variant="outline"
        :disabled="studio.rendering.value"
        :aria-label="`${tcAssets('detach', locale)}: ${asset.name}`"
        @click="removeAsset(asset.id)"
      >
        {{ tcAssets(asset.kind, locale) }}: {{ asset.name }} ×
      </Button>
      <p v-if="mode === 'video'" class="text-xs text-primary-comfy-canvas">
        {{ tcAssets('imageOnly', locale) }}
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
      :shared-settings="plannerSettings"
      :reference-choices="plannerSettings?.references ?? []"
      :creations="library.items.value"
      :urls="library.urls.value"
      :scene
      :namespace="namespace ?? 'guest'"
      :locale
      @edit="(item) => edit(library.urls.value[item.id], item.fileName)"
      @animate="(item) => animate(library.urls.value[item.id], item.fileName)"
      @view="libraryOpen = true"
      @apply="applyBuiltScene"
    />
    <CinematicEditDialog
      :assets="selectedAssets"
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
      :reference-save-error="referenceSaveError"
      :reference-preparing="preparing"
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

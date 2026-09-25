<script setup lang="ts">
import CinematicStudioStage from './CinematicStudioStage.vue'
import CinematicStudioPopoverControls from './CinematicStudioPopoverControls.vue'
import CinematicStudioToolbar from './CinematicStudioToolbar.vue'
import CinematicSeedControls from './CinematicSeedControls.vue'
import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useCinematicLeaveGuard } from '../../../composables/useCinematicLeaveGuard'
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
import CinematicEnhancer from './CinematicEnhancer.vue'
import CinematicRecovery from './CinematicRecovery.vue'
import { creativePrompt } from '../../../lib/workshop/cinematic-studio/creative'
import { cinematicPrompt } from '../../../lib/workshop/cinematic-studio/prompt'
import { useCinematicShot } from '../../../composables/useCinematicShot'
import type { DirectionPart } from '../../../lib/workshop/cinematic-studio/catalog'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { StarterShot } from '../../../lib/workshop/cinematic-studio/starters'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import RunLeaveDialog from '../RunLeaveDialog.vue'
import CinematicComposer from './CinematicComposer.vue'
import CinematicReviewDialog from './CinematicReviewDialog.vue'
import CinematicModeSwitch from './CinematicModeSwitch.vue'
import type { PopoverKey } from './picker-key'

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

const shot = useCinematicShot(models, editingModels)
const {
  studio,
  namespace,
  creative,
  creativeOpen,
  builderOpen,
  plannerSettings,
  applyBuiltScene,
  assetsOpen,
  motionOpen,
  transitionOpen,
  reviewMotion,
  applyTransition,
  selectedAssets,
  useAsset,
  edit,
  editSource,
  closeEdit,
  reviewEdit,
  library,
  libraryOpen,
  reuse,
  importRecipe,
  referenceSaveError,
  preparing,
  mode,
  availableModels,
  selectedModel,
  canReview,
  formatLabel,
  takeCount,
  modeReel,
  animate,
  nextShot,
  frameLoading,
  frameError,
  modelSlug,
  scene,
  direction,
  aspect,
  requestedSeed,
  seedBehavior,
  references,
  review,
  canConfirm,
  confirm,
  start: startShot,
  generate: generateShot
} = shot
const {
  open: popover,
  toggle: togglePopover,
  close: closePopover
} = useCinematicPopover<PopoverKey>()

const POPOVER_WIDTH: Readonly<Partial<Record<PopoverKey, string>>> = {
  camera: 'lg:w-4xl',
  direction: 'lg:w-2xl',
  references: 'lg:w-96',
  format: 'lg:w-96'
}
const popoverClass = computed(() =>
  cn(
    'fixed inset-x-0 bottom-0 z-50 max-h-[85svh] rounded-b-none lg:absolute lg:inset-x-auto lg:bottom-full lg:left-0 lg:mb-3 lg:max-h-[60svh] lg:rounded-b-2xl',
    (popover.value && POPOVER_WIDTH[popover.value]) ?? 'lg:w-xl'
  )
)

const starter = ref<string>()

const directionStart = ref<DirectionPart>()

function openPopover(key: PopoverKey, part?: DirectionPart) {
  const switchingTab =
    key === 'direction' &&
    popover.value === 'direction' &&
    part !== directionStart.value
  directionStart.value = part
  if (!switchingTab) togglePopover(key)
}

const { leavingTo, leave, stay } = useCinematicLeaveGuard(
  () => studio.rendering.value,
  () => studio.cancel()
)

function focusScene() {
  document.getElementById('cinematic-scene')?.focus()
}

function start(shot: StarterShot) {
  starter.value = shot.id
  startShot(shot)
  focusScene()
}

function generate() {
  closePopover()
  generateShot()
}

function generateOn(slug: string) {
  modelSlug.value = slug
  generate()
}

const animationModel = computed(() =>
  models.find((model) => model.video?.firstFrame === 'required')
)

function startVideo(prompt: string) {
  if (studio.rendering.value || frameLoading.value) return
  scene.value = prompt
  focusScene()
}

function chooseStartingImage() {
  if (studio.rendering.value || frameLoading.value || !animationModel.value)
    return
  if (
    !selectedModel.value?.video ||
    selectedModel.value.video.firstFrame === 'unsupported'
  )
    modelSlug.value = animationModel.value.slug
  closePopover()
  openPopover('references')
}
</script>

<template>
  <div
    class="mb-12 flex min-h-[calc(100svh-5rem)] flex-col lg:mb-20 lg:min-h-[calc(100svh-7rem)]"
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
    <CinematicStudioToolbar
      :shot
      :enhancement-model="enhancementModel"
      :locale
      @enhancer="enhancerOpen = true"
      @recipe="recipeOpen = true"
      @compare="compareOpen = true"
    />
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
    <CinematicStudioStage
      :shot
      :models
      :editing-models="editingModels"
      :starter
      :animation-model="animationModel"
      :locale
      @start-video="startVideo"
      @upload="chooseStartingImage"
      @saved="libraryOpen = true"
      @start="start"
      @again="generate"
      @switch-model="generateOn"
      @edit-scene="focusScene"
    />

    <div
      :class="
        cn(
          'z-50 bg-linear-to-t from-primary-comfy-ink via-primary-comfy-ink/90 to-transparent px-3 pt-4 pb-4 sm:px-6 sm:pb-6',
          mode === 'video' && !modeReel.takes.length
            ? 'relative'
            : 'sticky bottom-0'
        )
      "
    >
      <div class="relative mx-auto w-full max-w-7xl">
        <CinematicModeSwitch
          v-model="mode"
          :disabled="studio.rendering.value || frameLoading"
          :locale
          class="mb-3 w-fit"
          @update:model-value="closePopover"
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
        <CinematicStudioPopoverControls
          :shot
          :popover
          :direction-start="directionStart"
          :popover-class="popoverClass"
          :locale
          @close="closePopover"
        />
        <CinematicComposer
          v-model:scene="scene"
          v-model:model="modelSlug"
          :models="availableModels"
          :can-review="canReview"
          :direction
          :aspect
          :resolution="formatLabel"
          :takes="takeCount"
          :references
          :gate="studio.gate.value"
          :workspace-name="studio.session.value?.workspace.name"
          :rendering="studio.rendering.value"
          :open-popover="popover"
          :locale
          @open="openPopover"
          @generate="generate"
          @cancel="studio.cancel"
        >
          <template #generation-settings>
            <CinematicSeedControls
              v-if="selectedModel?.seed"
              v-model:seed="requestedSeed"
              v-model:behavior="seedBehavior"
              :bounds="selectedModel.seed"
              :disabled="studio.rendering.value || preparing"
              :locale
            />
          </template>
        </CinematicComposer>
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

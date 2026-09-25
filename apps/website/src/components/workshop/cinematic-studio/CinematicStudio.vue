<script setup lang="ts">
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
import type { DirectionPart } from '../../../lib/workshop/cinematic-studio/catalog'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { StarterShot } from '../../../lib/workshop/cinematic-studio/starters'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import RunLeaveDialog from '../RunLeaveDialog.vue'
import CinematicComposer from './CinematicComposer.vue'
import CinematicOutputControls from './CinematicOutputControls.vue'
import CinematicPicker from './CinematicPicker.vue'
import CinematicPopover from './CinematicPopover.vue'
import CinematicReferenceSlot from './CinematicReferenceSlot.vue'
import CinematicStage from './CinematicStage.vue'
import CinematicReviewDialog from './CinematicReviewDialog.vue'
import CinematicModeSwitch from './CinematicModeSwitch.vue'
import CinematicVideoControls from './CinematicVideoControls.vue'
import type { PopoverKey } from './picker-key'
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
  formatLabel,
  takeCount,
  modeReel,
  animate,
  useAsReference,
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
  cast,
  palette,
  references,
  review,
  canConfirm,
  confirm,
  choose,
  start: startShot,
  generate: generateShot
} = useCinematicShot(models, editingModels)
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
      :items="library.items.value"
      :urls="library.urls.value"
      :models="[...models, ...editingModels]"
      :locale
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
      <label
        v-if="selectedModel?.seed"
        class="flex items-center gap-2 text-xs text-primary-comfy-canvas"
        >{{ libraryCopy('seed', locale)
        }}<input
          :value="requestedSeed ?? ''"
          type="number"
          :step="selectedModel.seed.step"
          :min="selectedModel.seed.minimum"
          :max="selectedModel.seed.maximum"
          :placeholder="libraryCopy('random', locale)"
          :disabled="studio.rendering.value"
          class="h-9 w-32 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-2 text-primary-warm-white"
          @input="
            requestedSeed =
              ($event.target as HTMLInputElement).value === ''
                ? undefined
                : Number(($event.target as HTMLInputElement).value)
          "
      /></label>
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
    <p
      v-if="mode === 'video' && !modeReel.takes.length"
      class="m-auto max-w-xl px-6 py-12 text-center text-lg text-primary-comfy-canvas"
    >
      {{ tc('cinematic.video.start', locale) }}
    </p>
    <CinematicStage
      v-else
      :reel="modeReel"
      :models="[...models, ...editingModels]"
      :locale
      :starter
      @select="studio.select"
      @start="start"
      @again="generate"
      @reference="useAsReference"
      @animate="animate"
      @edit="edit"
      @switch-model="generateOn"
      @edit-scene="focusScene"
    />

    <div
      class="sticky bottom-0 z-50 bg-linear-to-t from-primary-comfy-ink via-primary-comfy-ink/90 to-transparent px-3 pt-4 pb-4 sm:px-6 sm:pb-6"
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
        <div
          v-if="popover"
          class="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-hidden="true"
        />
        <CinematicPicker
          v-if="popover && pickerGroups(popover).length"
          :key="`${popover}-${directionStart}`"
          :groups="pickerGroups(popover)"
          :start="directionStart"
          :direction
          :title="popoverTitle(popover, locale)"
          :locale
          :class="popoverClass"
          @choose="choose"
          @close="closePopover"
        />
        <CinematicPopover
          v-else-if="popover"
          :key="popover"
          :title="popoverTitle(popover, locale)"
          :locale
          :class="popoverClass"
          @close="closePopover"
        >
          <CinematicVideoControls
            v-if="
              mode === 'video' &&
              (popover === 'format' || popover === 'references')
            "
            v-model:aspect="aspect"
            v-model:duration="duration"
            v-model:resolution="videoResolution"
            v-model:audio="audio"
            v-model:first-frame="firstFrame"
            v-model:last-frame="lastFrame"
            :model="selectedModel"
            :locale
          />
          <div
            v-else-if="popover === 'references'"
            class="grid grid-cols-2 gap-2"
          >
            <CinematicReferenceSlot v-model="cast" kind="cast" :locale />
            <CinematicReferenceSlot v-model="palette" kind="palette" :locale />
          </div>
          <div v-else class="flex flex-col gap-3">
            <CinematicOutputControls
              v-model:aspect="aspect"
              v-model:resolution="resolution"
              v-model:takes="takes"
              :locale
            />
            <label
              class="flex cursor-pointer items-center gap-2.5 rounded-xl px-1 text-xs text-primary-warm-white"
            >
              <input
                v-model="enhance"
                type="checkbox"
                role="switch"
                class="peer sr-only"
              />
              <span
                class="relative h-4 w-7 shrink-0 rounded-full bg-transparency-white-t20 transition-colors peer-checked:bg-primary-comfy-yellow peer-focus-visible:ring-3 peer-focus-visible:ring-primary-comfy-yellow/50 after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-primary-comfy-ink after:transition-transform peer-checked:after:translate-x-3"
                aria-hidden="true"
              />
              {{ tc('cinematic.scene.enhance', locale) }}
              <span class="truncate text-primary-warm-gray">
                {{ tc('cinematic.scene.enhanceHint', locale) }}
              </span>
            </label>
          </div>
        </CinematicPopover>
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

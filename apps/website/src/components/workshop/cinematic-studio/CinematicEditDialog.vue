<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CinematicEditModelSettings from './CinematicEditModelSettings.vue'
import CinematicEditPromptFields from './CinematicEditPromptFields.vue'
import CinematicCameraEditControls from './CinematicCameraEditControls.vue'
import CinematicEditGenerationSettings from './CinematicEditGenerationSettings.vue'
import type { AssetReference } from '../../../lib/workshop/cinematic-studio/assets'
import { cameraGuidancePlan } from '../../../lib/workshop/cinematic-studio/camera-guidance'
import type { CameraGuidance } from '../../../lib/workshop/cinematic-studio/camera-guidance'
import { cn } from '@comfyorg/tailwind-utils'
import type { Locale } from '../../../i18n/translations'
import type {
  AspectRatio,
  Direction
} from '../../../lib/workshop/cinematic-studio/catalog'
import { ASPECT_RATIOS } from '../../../lib/workshop/cinematic-studio/catalog'
import { tcEditing } from '../../../lib/workshop/cinematic-studio/editing-copy'
import type { EditingCopyKey } from '../../../lib/workshop/cinematic-studio/editing-copy'
import {
  cameraViewDefaults,
  cinematicLookPrompt,
  cinematicRelightPrompt
} from '../../../lib/workshop/cinematic-studio/editing'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  source,
  models,
  direction,
  assets = [],
  locale = 'en'
} = defineProps<{
  source:
    | {
        file: File
        url: string
        name: string
        recipe?: {
          modelSlug: string
          prompt: string
          aspect: AspectRatio
          takes?: number
          seed?: number
          operation: Operation
        }
      }
    | undefined
  models: readonly CinematicModel[]
  direction: Direction
  assets?: readonly AssetReference[]
  locale?: Locale
}>()
type Operation = 'edit' | 'camera' | 'look' | 'relight'
const emit = defineEmits<{
  close: []
  review: [
    {
      takes: number
      seed?: number
      modelSlug: string
      prompt: string
      aspect: AspectRatio
      sourceFile: File
      sourceFiles?: readonly File[]
      cameraGuidance?: CameraGuidance
      guidanceAssets?: readonly Pick<
        AssetReference,
        'id' | 'name' | 'kind' | 'notes'
      >[]
      operation: Operation
    }
  ]
}>()
const operations: readonly Operation[] = ['edit', 'camera', 'look', 'relight']
const operation = ref<Operation>('edit')
const modelSlug = ref('')
const aspect = ref<AspectRatio>('16:9')
const variations = ref(1)
const seedInput = ref<string | number>('')
const seed = computed(() =>
  String(seedInput.value).trim() === '' ? undefined : Number(seedInput.value)
)
function seedInRange(
  value: number,
  bounds: NonNullable<CinematicModel['seed']>
) {
  return (
    (bounds.minimum === undefined || value >= bounds.minimum) &&
    (bounds.maximum === undefined || value <= bounds.maximum)
  )
}
const validSeed = computed(() => {
  const bounds = selectedModel.value?.seed
  if (seed.value === undefined) return true
  return (
    !!bounds &&
    Number.isFinite(seed.value) &&
    (bounds.step === 'any' || Number.isInteger(seed.value)) &&
    seedInRange(seed.value, bounds)
  )
})
watch(
  modelSlug,
  () => {
    seedInput.value = ''
  },
  { flush: 'sync' }
)
const camera = ref({ ...cameraViewDefaults })
const guidance = ref<CameraGuidance>({
  mode: 'frame',
  assetIds: [],
  notes: '',
  scene: ''
})
const selectedModel = computed(() =>
  models.find((model) => model.slug === modelSlug.value)
)
const aspectOptions = computed(() =>
  ASPECT_RATIOS.filter(
    (ratio) =>
      !selectedModel.value?.imageAspects ||
      selectedModel.value.imageAspects.includes(ratio.id)
  )
)
watch(
  [aspectOptions, aspect],
  ([options]) => {
    if (!options.some((option) => option.id === aspect.value) && options[0])
      aspect.value = options[0].id
  },
  { immediate: true }
)
const guidancePlan = computed(() => {
  if (!source) return undefined
  try {
    return cameraGuidancePlan(
      source.file,
      guidance.value,
      assets,
      selectedModel.value?.referenceMax ?? 1,
      camera.value
    )
  } catch {
    return undefined
  }
})
const lightType = ref('golden-hour')
const lightDirection = ref('side')
const instruction = ref('')
const additional = ref('')
const emptyLook = ref(false)
const t = (key: EditingCopyKey) => tcEditing(key, locale)
const fieldClass =
  'w-full min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm text-primary-warm-white'
const validVariations = computed(
  () =>
    Number.isInteger(variations.value) &&
    variations.value >= 1 &&
    variations.value <= 4
)
const ready = computed(
  () =>
    !!source &&
    validVariations.value &&
    validSeed.value &&
    models.some((model) => model.slug === modelSlug.value) &&
    !!instruction.value.trim() &&
    aspectOptions.value.some((option) => option.id === aspect.value) &&
    (operation.value !== 'camera' || !!guidancePlan.value)
)
function restoreRecipe(recipe: NonNullable<typeof source>['recipe']) {
  operation.value = recipe?.operation ?? 'edit'
  instruction.value = recipe?.prompt ?? ''
  if (recipe) modelSlug.value = recipe.modelSlug
  restoreOutputSettings(recipe)
}
function restoreOutputSettings(recipe: NonNullable<typeof source>['recipe']) {
  variations.value = recipe?.takes ?? 1
  seedInput.value = recipe?.seed ?? ''
  aspect.value = recipe?.aspect ?? '16:9'
}
watch(
  () => source?.file,
  (file) => {
    if (!file) return
    restoreRecipe(source?.recipe)
    additional.value = ''
    camera.value = { ...cameraViewDefaults }
    guidance.value = { mode: 'frame', assetIds: [], notes: '', scene: '' }
    lightType.value = 'golden-hour'
    lightDirection.value = 'side'
  },
  { immediate: true }
)
watch(
  () => models,
  (options) => {
    if (!options.some((model) => model.slug === modelSlug.value))
      modelSlug.value = options[0]?.slug ?? ''
  },
  { immediate: true }
)
function buildInstruction() {
  emptyLook.value = false
  if (operation.value === 'edit') return
  if (operation.value === 'camera')
    instruction.value = guidancePlan.value?.prompt ?? ''
  if (operation.value === 'relight')
    instruction.value = cinematicRelightPrompt(
      lightType.value,
      lightDirection.value
    )
  if (operation.value === 'look') {
    try {
      instruction.value = cinematicLookPrompt(direction)
    } catch {
      instruction.value = ''
      emptyLook.value = true
    }
  }
}
function changeGuidance() {
  guidance.value.assetIds =
    guidance.value.mode === 'frame'
      ? []
      : assets
          .filter(
            (asset) =>
              guidance.value.mode !== 'portrait' || asset.kind === 'character'
          )
          .slice(0, 1)
          .map((asset) => asset.id)
  buildInstruction()
}
function chooseAsset(id: string, event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  guidance.value.assetIds =
    guidance.value.mode === 'portrait'
      ? [id]
      : event.target.checked
        ? [...guidance.value.assetIds, id]
        : guidance.value.assetIds.filter((value) => value !== id)
  buildInstruction()
}
function selectOperation(value: Operation) {
  if (operation.value === value) return
  operation.value = value
  instruction.value = ''
  additional.value = ''
  buildInstruction()
}
function review() {
  if (!source || !ready.value) return
  emit('review', {
    takes: variations.value,
    ...(seed.value !== undefined ? { seed: seed.value } : {}),
    modelSlug: modelSlug.value,
    prompt: [instruction.value.trim(), additional.value.trim()]
      .filter(Boolean)
      .join('\n\n'),
    aspect: aspect.value,
    sourceFile:
      operation.value === 'camera'
        ? guidancePlan.value!.sourceFile
        : source.file,
    ...(operation.value === 'camera'
      ? {
          sourceFiles: guidancePlan.value!.sourceFiles,
          cameraGuidance: guidancePlan.value!.guidance,
          guidanceAssets: guidancePlan.value!.assets
        }
      : {}),
    operation: operation.value
  })
}
</script>

<template>
  <Dialog :open="!!source" @update:open="!$event && emit('close')">
    <DialogContent
      class="flex max-h-[90svh] flex-col overflow-y-auto sm:max-w-3xl"
      :close-label="t('cancel')"
    >
      <DialogTitle class="pr-12">{{ t('title') }}</DialogTitle>
      <DialogDescription>{{ t('description') }}</DialogDescription>
      <div
        v-if="source"
        class="grid min-w-0 gap-5 text-primary-warm-white sm:grid-cols-[1fr_2fr]"
      >
        <figure class="min-w-0">
          <img
            :src="source.url"
            :alt="t('source')"
            class="max-h-48 w-full rounded-xl object-contain sm:max-h-80"
          />
          <figcaption
            class="mt-2 text-xs wrap-break-word text-primary-comfy-canvas"
          >
            {{ source.name }}
          </figcaption>
        </figure>
        <form class="flex min-w-0 flex-col gap-4" @submit.prevent="review">
          <div
            class="grid grid-cols-2 gap-2"
            role="group"
            :aria-label="t('title')"
          >
            <button
              v-for="item in operations"
              :key="item"
              type="button"
              :aria-pressed="operation === item"
              :class="
                cn(
                  'rounded-lg border px-3 py-2 text-sm',
                  operation === item
                    ? 'border-primary-warm-white bg-transparency-white-t8'
                    : 'border-transparency-white-t20'
                )
              "
              @click="selectOperation(item)"
            >
              {{ t(item) }}
            </button>
          </div>
          <CinematicEditModelSettings
            v-model:model-slug="modelSlug"
            v-model:aspect="aspect"
            :models
            :aspect-options
            :locale
            :field-class
          />
          <CinematicCameraEditControls
            v-if="operation === 'camera'"
            v-model:camera="camera"
            v-model:guidance="guidance"
            :assets
            :source-name="source.name"
            :reference-max="selectedModel?.referenceMax ?? 1"
            :guidance-plan
            :field-class
            :locale
            @change-guidance="changeGuidance"
            @choose-asset="chooseAsset"
            @build-instruction="buildInstruction"
          />
          <CinematicEditPromptFields
            v-model:instruction="instruction"
            v-model:additional="additional"
            v-model:light-type="lightType"
            v-model:light-direction="lightDirection"
            :operation
            :empty-look
            :locale
            :field-class
            @change="buildInstruction"
          />
          <CinematicEditGenerationSettings
            v-model:variations="variations"
            v-model:seed-input="seedInput"
            :selected-model
            :valid-seed
            :field-class
            :locale
          />
          <p v-if="!models.length" role="status" class="text-sm">
            {{ t('unavailable') }}
          </p>
          <p class="text-xs/relaxed text-primary-comfy-canvas">
            {{ t('reviewNote') }}
          </p>
          <div class="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" @click="emit('close')">{{
              t('cancel')
            }}</Button>
            <Button type="submit" :disabled="!ready">{{ t('review') }}</Button>
          </div>
        </form>
      </div>
    </DialogContent>
  </Dialog>
</template>

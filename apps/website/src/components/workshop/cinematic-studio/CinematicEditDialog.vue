<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { tcEditing } from '../../../lib/workshop/cinematic-studio/editing-copy'
import type { EditingCopyKey } from '../../../lib/workshop/cinematic-studio/editing-copy'
import {
  cameraViewDefaults,
  cameraViewOptions,
  cinematicLookPrompt,
  cinematicRelightDirections,
  cinematicRelightPrompt,
  cinematicRelightTypes
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
const validSeed = computed(() => {
  const bounds = selectedModel.value?.seed
  if (seed.value === undefined) return true
  return (
    !!bounds &&
    Number.isFinite(seed.value) &&
    (bounds.step === 'any' || Number.isInteger(seed.value)) &&
    (bounds.minimum === undefined || seed.value >= bounds.minimum) &&
    (bounds.maximum === undefined || seed.value <= bounds.maximum)
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
const ready = computed(
  () =>
    !!source &&
    Number.isInteger(variations.value) &&
    variations.value >= 1 &&
    variations.value <= 4 &&
    validSeed.value &&
    models.some((model) => model.slug === modelSlug.value) &&
    !!instruction.value.trim() &&
    aspectOptions.value.some((option) => option.id === aspect.value) &&
    (operation.value !== 'camera' || !!guidancePlan.value)
)
watch(
  () => source?.file,
  (file) => {
    if (!file) return
    operation.value = source?.recipe?.operation ?? 'edit'
    instruction.value = source?.recipe?.prompt ?? ''
    if (source?.recipe) modelSlug.value = source.recipe.modelSlug
    variations.value = source?.recipe?.takes ?? 1
    seedInput.value = source?.recipe?.seed?.toString() ?? ''
    additional.value = ''
    aspect.value = source?.recipe?.aspect ?? '16:9'
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
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="flex min-w-0 flex-col gap-2 text-sm"
              >{{ t('model')
              }}<select v-model="modelSlug" :class="fieldClass">
                <option
                  v-for="model in models"
                  :key="model.slug"
                  :value="model.slug"
                >
                  {{ model.name }}
                </option>
              </select></label
            >
            <label class="flex min-w-0 flex-col gap-2 text-sm"
              >{{ t('aspect')
              }}<select v-model="aspect" :class="fieldClass">
                <option
                  v-for="ratio in aspectOptions"
                  :key="ratio.id"
                  :value="ratio.id"
                >
                  {{ ratio.id }} · {{ tc(ratio.label, locale) }}
                </option>
              </select></label
            >
          </div>
          <template v-if="operation === 'camera'">
            <fieldset
              class="flex min-w-0 flex-col gap-3 rounded-lg border border-transparency-white-t20 p-3"
            >
              <legend class="px-1 text-sm">{{ t('guidance') }}</legend>
              <label class="flex flex-col gap-2 text-sm"
                >{{ t('guidanceMode')
                }}<select
                  v-model="guidance.mode"
                  :class="fieldClass"
                  @change="changeGuidance"
                >
                  <option value="frame">{{ t('frameGuidance') }}</option>
                  <option
                    value="anchored"
                    :disabled="
                      !assets.length || (selectedModel?.referenceMax ?? 1) < 2
                    "
                  >
                    {{ t('anchoredGuidance') }}
                  </option>
                  <option
                    value="portrait"
                    :disabled="
                      !assets.some((asset) => asset.kind === 'character')
                    "
                  >
                    {{ t('portraitGuidance') }}
                  </option>
                </select></label
              >
              <p class="text-xs text-primary-comfy-canvas">
                {{
                  t(
                    guidance.mode === 'portrait'
                      ? 'portraitNote'
                      : guidance.mode === 'anchored'
                        ? 'anchoredNote'
                        : 'frameNote'
                  )
                }}
              </p>
              <template v-if="guidance.mode !== 'frame'">
                <label
                  v-for="asset in assets.filter(
                    (asset) =>
                      guidance.mode !== 'portrait' || asset.kind === 'character'
                  )"
                  :key="asset.id"
                  class="flex items-start gap-2 text-sm"
                  ><input
                    :type="guidance.mode === 'portrait' ? 'radio' : 'checkbox'"
                    name="camera-guidance-asset"
                    :checked="guidance.assetIds.includes(asset.id)"
                    @change="chooseAsset(asset.id, $event)"
                  /><span class="min-w-0 wrap-break-word"
                    >{{ asset.name
                    }}<small class="block text-primary-comfy-canvas">{{
                      asset.notes
                    }}</small></span
                  ></label
                >
              </template>
              <label
                v-if="guidance.mode === 'portrait'"
                class="flex flex-col gap-2 text-sm"
                >{{ t('rebuildScene')
                }}<textarea
                  v-model="guidance.scene"
                  :class="fieldClass"
                  rows="3"
                  maxlength="1500"
                  @input="buildInstruction"
                />
              </label>
              <label class="flex flex-col gap-2 text-sm"
                >{{ t('preserveNotes')
                }}<textarea
                  v-model="guidance.notes"
                  :class="fieldClass"
                  rows="2"
                  maxlength="750"
                  @input="buildInstruction"
                />
              </label>
              <p v-if="guidancePlan" class="text-xs text-primary-comfy-canvas">
                {{ t('orderedReferences') }}:
                {{
                  [
                    guidance.mode === 'portrait' ? '' : `1. ${source.name}`,
                    ...guidancePlan.assets.map(
                      (asset, index) =>
                        `${index + (guidance.mode === 'portrait' ? 1 : 2)}. ${asset.name}`
                    )
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </p>
              <p v-else role="alert" class="text-xs">
                {{ t('guidanceInvalid') }} {{ t('referenceCapacity') }}:
                {{ selectedModel?.referenceMax ?? 1 }}
              </p>
              <p
                v-if="!assets.length"
                class="text-xs text-primary-comfy-canvas"
              >
                {{ t('noAssets') }}
              </p>
            </fieldset>
            <div class="grid gap-3 sm:grid-cols-3">
              <label class="flex flex-col gap-2 text-sm"
                >{{ t('azimuth')
                }}<select
                  v-model="camera.azimuth"
                  :class="fieldClass"
                  @change="buildInstruction"
                >
                  <option
                    v-for="option in cameraViewOptions.azimuth"
                    :key="option.id"
                    :value="option.id"
                  >
                    {{ t(option.id) }}
                  </option>
                </select></label
              >
              <label class="flex flex-col gap-2 text-sm"
                >{{ t('elevation')
                }}<select
                  v-model="camera.elevation"
                  :class="fieldClass"
                  @change="buildInstruction"
                >
                  <option
                    v-for="option in cameraViewOptions.elevation"
                    :key="option.id"
                    :value="option.id"
                  >
                    {{ t(option.id) }}
                  </option>
                </select></label
              >
              <label class="flex flex-col gap-2 text-sm"
                >{{ t('distance')
                }}<select
                  v-model="camera.distance"
                  :class="fieldClass"
                  @change="buildInstruction"
                >
                  <option
                    v-for="option in cameraViewOptions.distance"
                    :key="option.id"
                    :value="option.id"
                  >
                    {{ t(option.id) }}
                  </option>
                </select></label
              >
            </div>
            <p class="text-xs/relaxed text-primary-comfy-canvas">
              {{ t('cameraNote') }}
            </p>
          </template>
          <p
            v-if="operation === 'look'"
            class="text-xs/relaxed text-primary-comfy-canvas"
          >
            {{ t(emptyLook ? 'emptyLook' : 'lookNote') }}
          </p>
          <template v-if="operation === 'relight'">
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-2 text-sm"
                >{{ t('type')
                }}<select
                  v-model="lightType"
                  :class="fieldClass"
                  @change="buildInstruction"
                >
                  <option
                    v-for="option in cinematicRelightTypes"
                    :key="option.id"
                    :value="option.id"
                  >
                    {{ t(option.id) }}
                  </option>
                </select></label
              >
              <label class="flex flex-col gap-2 text-sm"
                >{{ t('direction')
                }}<select
                  v-model="lightDirection"
                  :class="fieldClass"
                  @change="buildInstruction"
                >
                  <option
                    v-for="option in cinematicRelightDirections"
                    :key="option.id"
                    :value="option.id"
                  >
                    {{ t(option.id) }}
                  </option>
                </select></label
              >
            </div>
            <p class="text-xs/relaxed text-primary-comfy-canvas">
              {{ t('relightNote') }}
            </p>
          </template>
          <label class="flex flex-col gap-2 text-sm"
            >{{ t('instruction')
            }}<textarea
              v-model="instruction"
              :class="fieldClass"
              rows="6"
              maxlength="8000"
              :placeholder="t('placeholder')"
            />
          </label>
          <label v-if="operation !== 'edit'" class="flex flex-col gap-2 text-sm"
            >{{ t('extra')
            }}<textarea
              v-model="additional"
              :class="fieldClass"
              rows="2"
              maxlength="1500"
            />
          </label>
          <label class="flex flex-col gap-2 text-sm"
            >{{ t('variations') }}
            <select v-model.number="variations" :class="fieldClass">
              <option v-for="count in [1, 2, 3, 4]" :key="count" :value="count">
                {{ count }}
              </option>
            </select>
          </label>
          <p class="text-xs/relaxed text-primary-comfy-canvas">
            {{ t('variationsNote') }}
          </p>
          <label v-if="selectedModel?.seed" class="flex flex-col gap-2 text-sm"
            >{{ t('seed') }}
            <input
              v-model="seedInput"
              :aria-label="t('seed')"
              type="number"
              :min="selectedModel.seed.minimum"
              :max="selectedModel.seed.maximum"
              :step="selectedModel.seed.step"
              :class="fieldClass"
            />
            <span class="text-xs text-primary-comfy-canvas">{{
              t('seedNote')
            }}</span>
          </label>
          <p v-if="!validSeed" role="alert" class="text-sm">
            {{ t('invalidSeed') }}
          </p>
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

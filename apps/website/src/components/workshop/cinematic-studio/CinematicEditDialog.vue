<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  cameraViewPrompt,
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
          operation: Operation
        }
      }
    | undefined
  models: readonly CinematicModel[]
  direction: Direction
  locale?: Locale
}>()
type Operation = 'edit' | 'camera' | 'look' | 'relight'
const emit = defineEmits<{
  close: []
  review: [
    {
      modelSlug: string
      prompt: string
      aspect: AspectRatio
      sourceFile: File
      operation: Operation
    }
  ]
}>()
const operations: readonly Operation[] = ['edit', 'camera', 'look', 'relight']
const operation = ref<Operation>('edit')
const modelSlug = ref('')
const aspect = ref<AspectRatio>('16:9')
const camera = ref({ ...cameraViewDefaults })
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
    models.some((model) => model.slug === modelSlug.value) &&
    !!instruction.value.trim()
)
watch(
  () => source?.file,
  (file) => {
    if (!file) return
    operation.value = source?.recipe?.operation ?? 'edit'
    instruction.value = source?.recipe?.prompt ?? ''
    if (source?.recipe) modelSlug.value = source.recipe.modelSlug
    additional.value = ''
    aspect.value = source?.recipe?.aspect ?? '16:9'
    camera.value = { ...cameraViewDefaults }
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
    instruction.value = cameraViewPrompt(camera.value)
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
    modelSlug: modelSlug.value,
    prompt: [instruction.value.trim(), additional.value.trim()]
      .filter(Boolean)
      .join('\n\n'),
    aspect: aspect.value,
    sourceFile: source.file,
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
                  v-for="ratio in ASPECT_RATIOS"
                  :key="ratio.id"
                  :value="ratio.id"
                >
                  {{ ratio.id }} · {{ tc(ratio.label, locale) }}
                </option>
              </select></label
            >
          </div>
          <template v-if="operation === 'camera'">
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

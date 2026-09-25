<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useObjectUrl } from '@vueuse/core'
import type { Locale } from '../../../i18n/translations'
import type { AspectRatio } from '../../../lib/workshop/cinematic-studio/catalog'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import {
  buildMotionComparison,
  motionComparisonModels,
  MOTION_COMPARISON_MOVES
} from '../../../lib/workshop/cinematic-studio/motion-comparison'
import type {
  MotionComparisonPayload,
  MotionComparisonSource,
  MotionComparisonMove
} from '../../../lib/workshop/cinematic-studio/motion-comparison'
import { tcMotionComparison } from '../../../lib/workshop/cinematic-studio/motion-comparison-copy'
import type { MotionComparisonCopyKey } from '../../../lib/workshop/cinematic-studio/motion-comparison-copy'
import { videoResolutionsForAspect } from '../../../lib/workshop/cinematic-studio/video'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  open,
  source,
  models,
  scene,
  namespace,
  items = [],
  urls = {},
  locale = 'en'
} = defineProps<{
  open: boolean
  source?: MotionComparisonSource
  models: readonly CinematicModel[]
  scene: string
  namespace?: string
  items?: readonly SavedCreation[]
  urls?: Readonly<Record<string, string>>
  locale?: Locale
}>()
const emit = defineEmits<{
  'update:open': [boolean]
  review: [MotionComparisonPayload]
}>()
const t = (key: MotionComparisonCopyKey) => tcMotionComparison(key, locale)
const action = ref('')
const movements = ref<MotionComparisonMove[]>(['locked'])
const modelSlug = ref('')
const aspect = ref<AspectRatio>('16:9')
const duration = ref(5)
const resolution = ref('')
const audio = ref(false)
const seedText = ref('')
const selectedId = ref('')
const revealed = ref(false)
const uploaded = shallowRef<File>()
const uploadUrl = useObjectUrl(uploaded)
const choices = computed(() => motionComparisonModels(models))
const selected = computed(() =>
  choices.value.find((model) => model.slug === modelSlug.value)
)
const images = computed(() => items.filter((item) => item.kind === 'image'))
const saved = computed(() =>
  images.value.find((item) => item.id === selectedId.value)
)
const blocked = computed(
  () => !source && !uploaded.value && !!saved.value?.nsfw && !revealed.value
)
const currentSource = computed<MotionComparisonSource | undefined>(() => {
  if (source) return source
  if (uploaded.value && uploadUrl.value)
    return {
      file: uploaded.value,
      url: uploadUrl.value,
      name: uploaded.value.name
    }
  const item = saved.value
  if (!item || blocked.value || !urls[item.id]) return undefined
  return {
    file: new File([item.blob], `${item.name}.png`, { type: item.blob.type }),
    url: urls[item.id],
    name: item.name,
    id: item.id
  }
})
const resolutions = computed(() =>
  selected.value?.video
    ? videoResolutionsForAspect(selected.value.video, aspect.value)
    : []
)
watch(
  () => [open, source?.file, namespace] as const,
  ([isOpen, , scope], previous) => {
    if (scope !== previous?.[2] || (isOpen && !previous?.[0])) {
      action.value = scene
      movements.value = ['locked']
      uploaded.value = undefined
      selectedId.value = ''
      revealed.value = false
      seedText.value = ''
    }
  },
  { immediate: true }
)
watch(
  choices,
  (options) => {
    if (!options.some((model) => model.slug === modelSlug.value))
      modelSlug.value = options[0]?.slug ?? ''
  },
  { immediate: true }
)
watch(
  selected,
  (model) => {
    if (!model?.video) return
    duration.value = model.video.defaultDuration
    resolution.value = model.video.defaultResolution
    aspect.value = (model.video.aspects.find((value) => value === '16:9') ??
      model.video.aspects[0] ??
      '16:9') as AspectRatio
    audio.value = false
    seedText.value = ''
  },
  { immediate: true }
)
watch(
  resolutions,
  (options) => {
    if (!options.includes(resolution.value)) resolution.value = options[0] ?? ''
  },
  { immediate: true }
)
watch(selectedId, () => {
  uploaded.value = undefined
  revealed.value = false
})
const payload = computed(() => {
  if (!selected.value || !currentSource.value) return undefined
  try {
    return buildMotionComparison({
      model: selected.value,
      source: currentSource.value,
      action: action.value,
      movements: movements.value,
      aspect: aspect.value,
      durationSeconds: duration.value,
      resolution: resolution.value,
      generateAudio: audio.value,
      ...(seedText.value.trim() ? { seed: Number(seedText.value) } : {})
    })
  } catch {
    return undefined
  }
})
function upload(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  uploaded.value = input.files?.[0]
  input.value = ''
}
function toggle(move: MotionComparisonMove) {
  movements.value = movements.value.includes(move)
    ? movements.value.filter((value) => value !== move)
    : movements.value.length < 3
      ? [...movements.value, move]
      : movements.value
}
function review() {
  if (payload.value) emit('review', payload.value)
}
const field =
  'w-full min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm text-primary-warm-white'
</script>

<template>
  <Dialog :open @update:open="emit('update:open', $event)">
    <DialogContent
      :close-label="t('close')"
      class="max-h-[90svh] overflow-y-auto sm:max-w-3xl"
    >
      <DialogTitle>{{ t('title') }}</DialogTitle>
      <DialogDescription>{{ t('description') }}</DialogDescription>
      <div class="grid min-w-0 gap-5 sm:grid-cols-[1fr_2fr]">
        <div class="flex min-w-0 flex-col gap-3">
          <p class="text-sm font-medium">{{ t('source') }}</p>
          <img
            v-if="currentSource"
            :src="currentSource.url"
            :alt="currentSource.name"
            class="max-h-64 w-full rounded-lg object-contain"
          />
          <template v-if="!source">
            <label class="text-sm"
              >{{ t('pick')
              }}<select v-model="selectedId" :class="field">
                <option value="">—</option>
                <option v-for="item in images" :key="item.id" :value="item.id">
                  {{ item.name }}
                </option>
              </select></label
            >
            <template v-if="blocked"
              ><p class="text-sm">{{ t('sensitive') }}</p>
              <Button variant="outline" @click="revealed = true">{{
                t('reveal')
              }}</Button></template
            >
            <label class="text-sm"
              >{{ t('upload')
              }}<input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="mt-2 w-full text-xs"
                @change="upload"
            /></label>
          </template>
        </div>
        <div class="flex min-w-0 flex-col gap-4">
          <label class="text-sm"
            >{{ t('action')
            }}<textarea
              v-model="action"
              :class="field"
              rows="4"
              maxlength="12000"
            />
          </label>
          <fieldset>
            <legend class="mb-2 text-sm">{{ t('moves') }}</legend>
            <div class="grid gap-2 sm:grid-cols-2">
              <label
                v-for="move in MOTION_COMPARISON_MOVES"
                :key="move"
                class="flex gap-2 text-sm"
                ><input
                  type="checkbox"
                  :checked="movements.includes(move)"
                  :disabled="
                    movements.length === 3 && !movements.includes(move)
                  "
                  @change="toggle(move)"
                />{{ t(move) }}</label
              >
            </div>
          </fieldset>
          <p v-if="!choices.length" role="status">{{ t('empty') }}</p>
          <label class="text-sm"
            >{{ t('model')
            }}<select v-model="modelSlug" :class="field">
              <option
                v-for="model in choices"
                :key="model.slug"
                :value="model.slug"
              >
                {{ model.name }}
              </option>
            </select></label
          >
          <div v-if="selected?.video" class="grid gap-3 sm:grid-cols-2">
            <label class="text-sm"
              >{{ t('duration')
              }}<select v-model="duration" :class="field">
                <option
                  v-for="value in selected.video.durations"
                  :key="value"
                  :value
                >
                  {{ value }}
                </option>
              </select></label
            >
            <label class="text-sm"
              >{{ t('resolution')
              }}<select v-model="resolution" :class="field">
                <option v-for="value in resolutions" :key="value" :value>
                  {{ value }}
                </option>
              </select></label
            >
            <label v-if="selected.video.aspects.length" class="text-sm"
              >{{ t('aspect')
              }}<select v-model="aspect" :class="field">
                <option
                  v-for="value in selected.video.aspects"
                  :key="value"
                  :value
                >
                  {{ value }}
                </option>
              </select></label
            >
            <p v-else class="text-xs text-primary-comfy-canvas">
              {{ t('sourceAspect') }}
            </p>
            <label
              v-if="selected.video.generateAudio"
              class="flex items-center gap-2 text-sm"
              ><input v-model="audio" type="checkbox" />{{ t('audio') }}</label
            >
            <label v-if="selected.seed" class="text-sm"
              >{{ t('seed')
              }}<input
                v-model="seedText"
                type="number"
                :min="selected.seed.minimum"
                :max="selected.seed.maximum"
                :step="selected.seed.step"
                :class="field"
            /></label>
          </div>
          <p class="text-xs text-primary-comfy-canvas">{{ t('random') }}</p>
        </div>
      </div>
      <details v-if="payload">
        <summary class="cursor-pointer text-sm">{{ t('preview') }}</summary>
        <article
          v-for="clip in payload.clips"
          :key="clip.movement"
          class="mt-3"
        >
          <h3 class="text-sm font-medium">{{ t(clip.movement) }}</h3>
          <p
            class="mt-1 text-xs wrap-break-word whitespace-pre-wrap text-primary-comfy-canvas"
          >
            {{ clip.prompt }}
          </p>
        </article>
      </details>
      <p class="text-sm">{{ t('count') }}: {{ movements.length }}</p>
      <p class="text-xs text-primary-comfy-canvas">{{ t('credits') }}</p>
      <p
        v-if="!payload"
        role="status"
        class="text-xs text-primary-comfy-canvas"
      >
        {{ t('unavailable') }}
      </p>
      <Button :disabled="!payload" @click="review">{{ t('review') }}</Button>
    </DialogContent>
  </Dialog>
</template>

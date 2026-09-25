<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { sampleCreativePalette } from './creative-palette-sampling'
import CinematicCreativeFilm from './CinematicCreativeFilm.vue'
import CinematicCreativeMovement from './CinematicCreativeMovement.vue'
import CinematicCreativePalette from './CinematicCreativePalette.vue'
import CinematicCreativeLights from './CinematicCreativeLights.vue'
import type { Locale } from '../../../i18n/translations'
import { tcCreative } from '../../../lib/workshop/cinematic-studio/creative-copy'
import type {
  CreativeSettings,
  CreativePreset,
  HARMONIES
} from '../../../lib/workshop/cinematic-studio/creative'
import {
  beginCreativeDraft,
  defaultCreativeSettings,
  validateCreativeSettings,
  moveCreativeColor,
  removeCreativeColor,
  creativeHarmony,
  creativePrompt,
  parseCreativePresets
} from '../../../lib/workshop/cinematic-studio/creative'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  open,
  modelValue,
  namespace,
  mode = 'image',
  locale = 'en'
} = defineProps<{
  open: boolean
  modelValue: CreativeSettings
  namespace: string
  mode?: 'image' | 'video'
  locale?: Locale
}>()
const emit = defineEmits<{
  'update:open': [boolean]
  'update:modelValue': [CreativeSettings]
}>()
const draft = ref(defaultCreativeSettings())
const search = ref('')
const harmony = ref<(typeof HARMONIES)[number]>('analogous')
const name = ref('')
const presets = ref<CreativePreset[]>([])
const status = ref('')
const sampling = ref(false)
let revision = 0
const storageKey = computed(
  () => `cinematic-creative-presets-v1:${encodeURIComponent(namespace)}`
)
const fieldClass =
  'min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm text-primary-warm-white'
const actionClass =
  'rounded-lg border border-transparency-white-t20 px-3 py-2 text-xs text-primary-warm-white hover:bg-transparency-white-t8 disabled:opacity-40'
const t = (key: Parameters<typeof tcCreative>[0]) => tcCreative(key, locale)
watch(
  () => [open, namespace] as const,
  ([value]) => {
    revision++
    status.value = ''
    sampling.value = false
    presets.value = []
    name.value = ''
    if (!value) return
    draft.value = beginCreativeDraft(modelValue)
    search.value = ''
    try {
      presets.value = parseCreativePresets(
        localStorage.getItem(storageKey.value)
      )
    } catch {
      presets.value = []
    }
  },
  { immediate: true }
)
const valid = computed(() => {
  try {
    validateCreativeSettings(draft.value)
    return true
  } catch {
    return false
  }
})
const preview = computed(() =>
  valid.value ? creativePrompt(draft.value, mode) : ''
)
function apply() {
  if (!valid.value) return
  emit('update:modelValue', validateCreativeSettings(draft.value))
  emit('update:open', false)
}
function moveColor(index: number, offset: number) {
  try {
    draft.value = moveCreativeColor(draft.value, index, index + offset)
  } catch {
    status.value = t('error')
  }
}
function removeColor(index: number) {
  try {
    draft.value = removeCreativeColor(draft.value, index)
  } catch {
    status.value = t('error')
  }
}
function buildHarmony() {
  try {
    draft.value.palette = creativeHarmony(draft.value.palette[0], harmony.value)
    draft.value.paletteMain = null
  } catch {
    status.value = t('error')
  }
}
function savePreset() {
  if (!valid.value || !name.value.trim()) return
  const next = [
    ...presets.value.filter((preset) => preset.name !== name.value.trim()),
    {
      name: name.value.trim().slice(0, 60),
      settings: validateCreativeSettings(draft.value)
    }
  ].slice(-16)
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(next))
    presets.value = next
    status.value = t('saved')
  } catch {
    status.value = t('storageError')
  }
}
function canSample(file: File) {
  return (
    ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) &&
    file.size <= 10 * 1024 * 1024
  )
}
async function sampleImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!canSample(file)) {
    status.value = t('sampleError')
    return
  }
  const started = revision
  sampling.value = true
  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(file, {
      resizeWidth: 80,
      resizeHeight: 80
    })
    const palette = sampleCreativePalette(bitmap)
    if (started !== revision || !open) return
    draft.value.palette = palette
    draft.value.paletteMain = null
    status.value = ''
  } catch {
    if (started === revision) status.value = t('sampleError')
  } finally {
    bitmap?.close()
    if (started === revision) sampling.value = false
  }
}
</script>

<template>
  <Dialog :open @update:open="emit('update:open', $event)">
    <DialogContent
      class="flex max-h-[90svh] flex-col overflow-y-auto sm:max-w-3xl"
      :close-label="t('cancel')"
    >
      <DialogTitle class="pr-12">{{ t('title') }}</DialogTitle>
      <DialogDescription>{{ t('guidance') }}</DialogDescription>
      <div class="flex flex-col gap-6 text-primary-warm-white">
        <CinematicCreativeFilm v-model="draft" :locale :field-class :mode />
        <CinematicCreativeMovement
          v-if="mode === 'video'"
          v-model="draft"
          v-model:search="search"
          :locale
          :field-class
          :action-class
        />
        <CinematicCreativePalette
          v-model="draft"
          v-model:harmony="harmony"
          :locale
          :field-class
          :action-class
          :valid
          :sampling
          :namespace
          @move-color="moveColor"
          @remove-color="removeColor"
          @build-harmony="buildHarmony"
          @sample-image="sampleImage"
        />
        <CinematicCreativeLights
          v-model="draft"
          :locale
          :field-class
          :action-class
          :namespace
        />
        <details class="rounded-xl border border-transparency-white-t20 p-3">
          <summary class="cursor-pointer text-sm font-semibold">
            {{ t('combinedPresets') }}
          </summary>
          <p class="my-3 text-xs text-primary-comfy-canvas">
            {{ t('combinedNote') }}
          </p>
          <div class="flex flex-wrap gap-2">
            <input
              v-model="name"
              :class="fieldClass"
              class="grow"
              maxlength="60"
              :placeholder="t('presetName')"
              :aria-label="t('presetName')"
            /><button
              type="button"
              :class="actionClass"
              :disabled="!valid || !name.trim()"
              @click="savePreset"
            >
              {{ t('save') }}
            </button>
          </div>
          <div
            v-for="preset in presets"
            :key="preset.name"
            class="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span>{{ preset.name }}</span
            ><button
              type="button"
              :class="actionClass"
              @click="draft = beginCreativeDraft(preset.settings)"
            >
              {{ t('load') }}
            </button>
          </div>
        </details>
        <details>
          <summary class="cursor-pointer text-sm">{{ t('preview') }}</summary>
          <p class="mt-2 text-sm whitespace-pre-wrap text-primary-comfy-canvas">
            {{ preview || t('none') }}
          </p>
        </details>
        <p v-if="status || !valid" role="status" class="text-sm">
          {{ status || t('error') }}
        </p>
        <div
          class="sticky bottom-0 flex flex-wrap justify-end gap-2 bg-primary-comfy-ink py-3"
        >
          <Button
            variant="outline"
            @click="draft = defaultCreativeSettings()"
            >{{ t('reset') }}</Button
          >
          <Button variant="outline" @click="emit('update:open', false)">{{
            t('cancel')
          }}</Button>
          <Button :disabled="!valid || sampling" @click="apply">{{
            t('apply')
          }}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

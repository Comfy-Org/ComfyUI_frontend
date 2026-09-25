<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Locale } from '../../../i18n/translations'
import { tcCreative } from '../../../lib/workshop/cinematic-studio/creative-copy'
import type {
  CreativeSettings,
  CreativePreset,
  Movement
} from '../../../lib/workshop/cinematic-studio/creative'
import {
  GENRES,
  ERAS,
  TEMPOS,
  MOVEMENTS,
  LIGHT_POSITIONS,
  HARMONIES,
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
const moves = computed(() =>
  MOVEMENTS.filter(([id, description]) =>
    `${t(id)} ${description}`.toLowerCase().includes(search.value.toLowerCase())
  )
)
function apply() {
  if (!valid.value) return
  emit('update:modelValue', validateCreativeSettings(draft.value))
  emit('update:open', false)
}
function toggleMove(id: Movement) {
  const moves = draft.value.movements
  if (moves.includes(id))
    draft.value.movements = moves.filter((move) => move !== id)
  else if (moves.length < 4) moves.push(id)
}
function reorderMove(index: number, offset: number) {
  const moves = [...draft.value.movements]
  const [move] = moves.splice(index, 1)
  moves.splice(index + offset, 0, move)
  draft.value.movements = moves
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
async function sampleImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  ) {
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
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(bitmap, 0, 0)
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    const buckets = new Map<string, number>()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const color =
        '#' +
        [data[i], data[i + 1], data[i + 2]]
          .map((value) =>
            Math.min(255, Math.round(value / 32) * 32)
              .toString(16)
              .padStart(2, '0')
          )
          .join('')
      buckets.set(color, (buckets.get(color) ?? 0) + 1)
    }
    if (!buckets.size) throw new Error('Empty image')
    if (started !== revision || !open) return
    draft.value.palette = [...buckets]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([color]) => color)
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
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label class="flex flex-col gap-2 text-sm"
            >{{ t('genre')
            }}<select v-model="draft.genre" :class="fieldClass">
              <option v-for="value in GENRES" :key="value" :value>
                {{ t(value) }}
              </option>
            </select></label
          >
          <label class="flex flex-col gap-2 text-sm"
            >{{ t('era')
            }}<select v-model="draft.era" :class="fieldClass">
              <option v-for="value in ERAS" :key="value" :value>
                {{ t(value) }}
              </option>
            </select></label
          >
          <label v-if="mode === 'video'" class="flex flex-col gap-2 text-sm"
            >{{ t('tempo')
            }}<select v-model="draft.tempo" :class="fieldClass">
              <option v-for="value in TEMPOS" :key="value" :value>
                {{ t(value) }}
              </option>
            </select></label
          >
        </div>
        <section v-if="mode === 'video'" class="flex flex-col gap-3">
          <h3 class="font-semibold">
            {{ t('movements') }} · {{ draft.movements.length }}/4
          </h3>
          <ol class="flex flex-col gap-2">
            <li
              v-for="(move, index) in draft.movements"
              :key="move"
              class="flex flex-wrap items-center gap-2 rounded-lg border border-transparency-white-t8 p-2"
            >
              <span class="mr-auto text-sm"
                >{{ index + 1 }}. {{ t(move) }}</span
              >
              <button
                type="button"
                :class="actionClass"
                :aria-label="`${t('earlier')}: ${t(move)}`"
                :disabled="index === 0"
                @click="reorderMove(index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                :class="actionClass"
                :aria-label="`${t('later')}: ${t(move)}`"
                :disabled="index === draft.movements.length - 1"
                @click="reorderMove(index, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                :class="actionClass"
                @click="toggleMove(move)"
              >
                {{ t('remove') }}
              </button>
            </li>
          </ol>
          <button
            v-if="draft.movements.length"
            type="button"
            :class="actionClass"
            @click="draft.movements = []"
          >
            {{ t('clear') }}
          </button>
          <input
            v-model="search"
            type="search"
            :class="fieldClass"
            :placeholder="t('search')"
            :aria-label="t('search')"
          />
          <div
            class="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
          >
            <button
              v-for="[id] in moves"
              :key="id"
              type="button"
              :class="actionClass"
              :aria-pressed="draft.movements.includes(id)"
              :disabled="
                draft.movements.length >= 4 && !draft.movements.includes(id)
              "
              @click="toggleMove(id)"
            >
              {{ draft.movements.includes(id) ? '✓ ' : '' }}{{ t(id) }}
            </button>
          </div>
          <p v-if="!moves.length" class="text-sm">{{ t('empty') }}</p>
        </section>
        <section class="flex flex-col gap-3">
          <h3 class="font-semibold">
            {{ t('palette') }} · {{ draft.palette.length }}/8
          </h3>
          <div
            v-for="(_, index) in draft.palette"
            :key="index"
            class="flex flex-wrap items-center gap-2"
          >
            <input
              v-model="draft.palette[index]"
              type="color"
              class="h-9 w-10 shrink-0"
              :aria-label="`${t('color')} ${index + 1}`"
            />
            <input
              v-model="draft.palette[index]"
              :class="fieldClass"
              class="w-28"
              maxlength="7"
              pattern="#[0-9a-fA-F]{6}"
              :aria-label="`${t('color')} ${index + 1} HEX`"
            />
            <button
              type="button"
              :class="actionClass"
              :aria-label="`${t('earlier')}: ${t('color')} ${index + 1}`"
              :disabled="index === 0 || !valid"
              @click="moveColor(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              :class="actionClass"
              :aria-label="`${t('later')}: ${t('color')} ${index + 1}`"
              :disabled="index === draft.palette.length - 1 || !valid"
              @click="moveColor(index, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              :class="actionClass"
              :disabled="!valid"
              @click="removeColor(index)"
            >
              {{ t('remove') }}
            </button>
          </div>
          <button
            type="button"
            :class="actionClass"
            :disabled="draft.palette.length >= 8"
            @click="draft.palette.push('#808080')"
          >
            {{ t('addColor') }}
          </button>
          <label v-if="draft.palette.length" class="flex flex-col gap-2 text-sm"
            >{{ t('main')
            }}<select v-model="draft.paletteMain" :class="fieldClass">
              <option :value="null">{{ t('noMain') }}</option>
              <option
                v-for="(color, index) in draft.palette"
                :key="index"
                :value="index"
              >
                {{ index + 1 }} · {{ color }}
              </option>
            </select></label
          >
          <div v-if="draft.palette.length" class="flex flex-wrap gap-2">
            <select
              v-model="harmony"
              :class="fieldClass"
              :aria-label="t('harmony')"
            >
              <option v-for="value in HARMONIES" :key="value" :value>
                {{ t(value) }}
              </option></select
            ><button
              type="button"
              :class="actionClass"
              :disabled="!valid"
              @click="buildHarmony"
            >
              {{ t('buildHarmony') }}
            </button>
          </div>
          <label class="flex flex-col gap-2 text-sm"
            >{{ t('sample')
            }}<input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="max-w-full text-xs"
              :disabled="sampling"
              @change="sampleImage"
          /></label>
        </section>
        <section class="flex flex-col gap-3">
          <h3 class="font-semibold">
            {{ t('lights') }} · {{ draft.lights.length }}/3
          </h3>
          <div
            v-for="(light, index) in draft.lights"
            :key="index"
            class="grid grid-cols-2 gap-3 rounded-lg border border-transparency-white-t20 p-3"
          >
            <label class="flex flex-col gap-2 text-sm"
              >{{ t('position') }} {{ index + 1
              }}<select v-model="light.position" :class="fieldClass">
                <option v-for="value in LIGHT_POSITIONS" :key="value" :value>
                  {{ t(value) }}
                </option>
              </select></label
            >
            <label class="flex flex-col gap-2 text-sm"
              >{{ t('color') }} {{ index + 1
              }}<input v-model="light.color" type="color" class="h-9 w-full"
            /></label>
            <label class="flex flex-col gap-2 text-sm"
              >{{ t('brightness') }} {{ light.brightness }}%<input
                v-model.number="light.brightness"
                type="range"
                min="0"
                max="100"
            /></label>
            <label class="flex flex-col gap-2 text-sm"
              >{{ t('diffusion') }} {{ light.diffusion }}%<input
                v-model.number="light.diffusion"
                type="range"
                min="0"
                max="100"
            /></label>
            <button
              type="button"
              :class="actionClass"
              @click="draft.lights.splice(index, 1)"
            >
              {{ t('remove') }}
            </button>
          </div>
          <button
            type="button"
            :class="actionClass"
            :disabled="draft.lights.length >= 3"
            @click="
              draft.lights.push({
                position: 'front',
                color: '#ffffff',
                brightness: 60,
                diffusion: 60
              })
            "
          >
            {{ t('addLight') }}
          </button>
        </section>
        <section class="flex flex-col gap-3">
          <h3 class="font-semibold">{{ t('presets') }}</h3>
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
        </section>
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

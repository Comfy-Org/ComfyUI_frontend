<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import type {
  CinematicTransitionApply,
  TransitionFrame,
  TransitionModel
} from '../../../lib/workshop/cinematic-studio/transition'
import {
  savedTransitionFrame,
  transitionModels,
  transitionPayload,
  uploadedTransitionFrame
} from '../../../lib/workshop/cinematic-studio/transition'
import { tcTransition } from '../../../lib/workshop/cinematic-studio/transition-copy'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  open,
  items,
  urls,
  models,
  namespace,
  locale = 'en'
} = defineProps<{
  open: boolean
  items: readonly SavedCreation[]
  urls: Readonly<Record<string, string>>
  models: readonly TransitionModel[]
  namespace: string | undefined
  locale?: Locale
}>()
const emit = defineEmits<{
  'update:open': [boolean]
  apply: [value: CinematicTransitionApply]
}>()
type Side = 'first' | 'last'
type PreviewFrame = TransitionFrame & { preview: string }
const sides: readonly Side[] = ['first', 'last']
const frames = shallowRef<Partial<Record<Side, PreviewFrame>>>({})
const selected = ref<Record<Side, string>>({ first: '', last: '' })
const reading = ref<Record<Side, boolean>>({ first: false, last: false })
const errors = ref<Record<Side, boolean>>({ first: false, last: false })
const revealed = ref<readonly string[]>([])
const scene = ref('')
const modelSlug = ref('')
const supported = computed(() => transitionModels(models))
const images = computed(() => items.filter((item) => item.kind === 'image'))
const busy = computed(() => reading.value.first || reading.value.last)
const canApply = computed(
  () =>
    !!namespace &&
    !busy.value &&
    !!frames.value.first &&
    !!frames.value.last &&
    supported.value.some((model) => model.slug === modelSlug.value) &&
    scene.value.trim().length <= 8000
)
const t = (key: Parameters<typeof tcTransition>[0]) => tcTransition(key, locale)
const fieldClass =
  'w-full min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm text-primary-warm-white'
let epoch = 0
const revisions: Record<Side, number> = { first: 0, last: 0 }

function clear(side: Side) {
  const previous = frames.value[side]
  if (previous) URL.revokeObjectURL(previous.preview)
  frames.value = { ...frames.value, [side]: undefined }
}
function reset() {
  epoch++
  clear('first')
  clear('last')
  selected.value = { first: '', last: '' }
  reading.value = { first: false, last: false }
  errors.value = { first: false, last: false }
  revealed.value = []
  scene.value = ''
  modelSlug.value = supported.value[0]?.slug ?? ''
}
watch(() => [open, namespace] as const, reset, { immediate: true })
onScopeDispose(reset)

function hidden(side: Side): SavedCreation | undefined {
  return images.value.find(
    (item) =>
      item.id === selected.value[side] &&
      item.nsfw &&
      !revealed.value.includes(item.id)
  )
}
async function load(side: Side, source: SavedCreation | File) {
  if (!open || !namespace) return
  const current = epoch
  const revision = ++revisions[side]
  clear(side)
  reading.value[side] = true
  errors.value[side] = false
  try {
    const frame =
      source instanceof File
        ? await uploadedTransitionFrame(source)
        : await savedTransitionFrame(source, revealed.value.includes(source.id))
    if (current !== epoch || revision !== revisions[side] || !open) return
    frames.value = {
      ...frames.value,
      [side]: { ...frame, preview: URL.createObjectURL(frame.file) }
    }
  } catch {
    if (current === epoch && revision === revisions[side])
      errors.value[side] = true
  } finally {
    if (current === epoch && revision === revisions[side])
      reading.value[side] = false
  }
}
function chooseSaved(side: Side, event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  revisions[side]++
  clear(side)
  reading.value[side] = false
  errors.value[side] = false
  selected.value[side] = event.target.value
  const item = images.value.find(
    (candidate) => candidate.id === selected.value[side]
  )
  if (item && !hidden(side)) void load(side, item)
}
function reveal(side: Side) {
  const item = hidden(side)
  if (!item) return
  revealed.value = [...revealed.value, item.id]
  for (const boundary of sides) {
    if (selected.value[boundary] === item.id) void load(boundary, item)
  }
}
function upload(side: Side, event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  selected.value[side] = ''
  void load(side, file)
}
function swap() {
  if (busy.value) return
  frames.value = { first: frames.value.last, last: frames.value.first }
  selected.value = { first: selected.value.last, last: selected.value.first }
  errors.value = { first: errors.value.last, last: errors.value.first }
}
function apply() {
  const { first, last } = frames.value
  if (!canApply.value || !first || !last) return
  emit(
    'apply',
    transitionPayload(modelSlug.value, models, first, last, scene.value)
  )
  emit('update:open', false)
}
function preview(side: Side): string | undefined {
  const frame = frames.value[side]
  return frame?.sourceId
    ? (urls[frame.sourceId] ?? frame.preview)
    : frame?.preview
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="flex max-h-[90dvh] flex-col gap-4 overflow-y-auto sm:max-w-3xl"
      :close-label="t('cancel')"
    >
      <DialogTitle class="pr-12">{{ t('title') }}</DialogTitle>
      <DialogDescription>{{ t('description') }}</DialogDescription>
      <p
        v-if="!namespace"
        role="status"
        class="text-sm text-primary-comfy-canvas"
      >
        {{ t('account') }}
      </p>
      <p
        v-if="!supported.length"
        role="status"
        class="text-sm text-primary-comfy-canvas"
      >
        {{ t('unsupported') }}
      </p>
      <label class="flex flex-col gap-2 text-sm text-primary-warm-white"
        >{{ t('model')
        }}<select v-model="modelSlug" :class="fieldClass">
          <option
            v-for="model in supported"
            :key="model.slug"
            :value="model.slug"
          >
            {{ model.name }}
          </option>
        </select></label
      >
      <div class="grid min-w-0 gap-4 sm:grid-cols-2">
        <section
          v-for="side in sides"
          :key="side"
          class="flex min-w-0 flex-col gap-3 rounded-xl border border-transparency-white-t8 p-3"
          :aria-label="t(side)"
        >
          <h3 class="text-sm font-semibold text-primary-warm-white">
            {{ t(side) }}
          </h3>
          <label class="flex flex-col gap-1 text-sm text-primary-comfy-canvas"
            >{{ t('saved')
            }}<select
              :value="selected[side]"
              :class="fieldClass"
              :disabled="!namespace"
              @change="chooseSaved(side, $event)"
            >
              <option value="">{{ t('empty') }}</option>
              <option v-for="item in images" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select></label
          >
          <label
            class="flex min-w-0 flex-col gap-1 text-sm text-primary-comfy-canvas"
            >{{ t('upload')
            }}<input
              class="w-full min-w-0 text-sm"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              :disabled="!namespace"
              @change="upload(side, $event)"
          /></label>
          <div
            v-if="hidden(side)"
            class="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl bg-primary-comfy-ink p-3 text-sm text-primary-comfy-canvas"
          >
            <p>{{ t('hidden') }}</p>
            <Button variant="outline" size="sm" @click="reveal(side)">{{
              t('reveal')
            }}</Button>
          </div>
          <img
            v-else-if="frames[side]"
            :src="preview(side)"
            :alt="t(side)"
            class="aspect-video w-full rounded-xl object-contain"
          />
          <p v-else class="py-6 text-center text-sm text-primary-comfy-canvas">
            {{ t('empty') }}
          </p>
          <p
            v-if="errors[side]"
            role="alert"
            class="text-sm text-primary-warm-white"
          >
            {{ t('error') }}
          </p>
        </section>
      </div>
      <Button variant="outline" :disabled="busy" @click="swap">{{
        t('swap')
      }}</Button>
      <label class="flex flex-col gap-2 text-sm text-primary-warm-white"
        >{{ t('scene')
        }}<textarea
          v-model="scene"
          :class="fieldClass"
          maxlength="8000"
          rows="3"
        />
      </label>
      <p class="text-sm text-primary-comfy-canvas">{{ t('settings') }}</p>
      <div class="flex flex-wrap justify-end gap-2">
        <Button variant="outline" @click="emit('update:open', false)">{{
          t('cancel')
        }}</Button
        ><Button :disabled="!canApply" @click="apply">{{ t('apply') }}</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

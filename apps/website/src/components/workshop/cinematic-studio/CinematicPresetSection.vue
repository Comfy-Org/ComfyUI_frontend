<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type {
  CreativeSettings,
  CreativePreset
} from '../../../lib/workshop/cinematic-studio/creative'
import {
  defaultCreativeSettings,
  parseCreativePresets
} from '../../../lib/workshop/cinematic-studio/creative'
import { applyCreativePresetPart } from '../../../lib/workshop/cinematic-studio/creative-presets'
import type { CreativePresetKind } from '../../../lib/workshop/cinematic-studio/creative-presets'
import { tcCreative } from '../../../lib/workshop/cinematic-studio/creative-copy'
import Button from '../../ui/button/Button.vue'

const {
  kind,
  namespace,
  locale = 'en'
} = defineProps<{
  kind: CreativePresetKind
  namespace: string
  locale?: Locale
}>()
const draft = defineModel<CreativeSettings>({ required: true })
const name = ref('')
const presets = ref<CreativePreset[]>([])
const status = ref('')
const key = computed(
  () => `cinematic-${kind}-presets-v1:${encodeURIComponent(namespace)}`
)
const t = (key: Parameters<typeof tcCreative>[0]) => tcCreative(key, locale)
const labels = computed(() =>
  kind === 'palette'
    ? {
        title: t('palettePresets'),
        name: t('palettePresetName'),
        save: t('savePalette'),
        load: t('loadPalette'),
        note: t('palettePresetNote')
      }
    : {
        title: t('lightingPresets'),
        name: t('lightingPresetName'),
        save: t('saveLighting'),
        load: t('loadLighting'),
        note: t('lightingPresetNote')
      }
)
const canSave = computed(() => {
  try {
    const settings = applyCreativePresetPart(
      defaultCreativeSettings(),
      draft.value,
      kind
    )
    return (
      !!name.value.trim() &&
      (kind === 'palette'
        ? settings.palette.length > 0
        : settings.lights.length > 0)
    )
  } catch {
    return false
  }
})
watch(
  key,
  () => {
    name.value = ''
    status.value = ''
    presets.value = []
    try {
      presets.value = parseCreativePresets(localStorage.getItem(key.value))
    } catch {
      status.value = t('storageError')
    }
  },
  { immediate: true }
)
function save() {
  if (!canSave.value) return
  try {
    const preset = {
      name: name.value.trim().slice(0, 60),
      settings: applyCreativePresetPart(
        defaultCreativeSettings(),
        draft.value,
        kind
      )
    }
    const next = [
      ...parseCreativePresets(localStorage.getItem(key.value)).filter(
        (item) => item.name !== preset.name
      ),
      preset
    ].slice(-16)
    localStorage.setItem(key.value, JSON.stringify(next))
    presets.value = next
    status.value = t('saved')
  } catch {
    status.value = t('storageError')
  }
}
function load(preset: CreativePreset) {
  draft.value = applyCreativePresetPart(draft.value, preset.settings, kind)
  status.value = t('presetLoaded')
}
</script>

<template>
  <section
    :aria-label="labels.title"
    class="flex min-w-0 flex-col gap-3 rounded-xl border border-transparency-white-t20 p-3"
  >
    <h4 class="text-sm font-semibold">{{ labels.title }}</h4>
    <p class="text-xs/relaxed text-primary-comfy-canvas">{{ labels.note }}</p>
    <div class="flex flex-wrap gap-2">
      <input
        v-model="name"
        maxlength="60"
        :aria-label="labels.name"
        :placeholder="labels.name"
        class="min-w-0 flex-1 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm text-primary-warm-white"
      />
      <Button size="sm" variant="outline" :disabled="!canSave" @click="save">{{
        labels.save
      }}</Button>
    </div>
    <div
      v-for="preset in presets"
      :key="preset.name"
      class="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"
    >
      <span class="max-w-full min-w-0 wrap-break-word">{{ preset.name }}</span>
      <Button
        size="sm"
        variant="outline"
        :aria-label="`${labels.load}: ${preset.name}`"
        @click="load(preset)"
        >{{ labels.load }}</Button
      >
    </div>
    <p v-if="status" role="status" class="text-xs text-primary-comfy-canvas">
      {{ status }}
    </p>
  </section>
</template>

<script setup lang="ts">
import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import EditorSlider from '@/components/workshop/app-editor/EditorSlider.vue'
import EditorSwitch from '@/components/workshop/app-editor/EditorSwitch.vue'
import RelightSwatches from './RelightSwatches.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup, lightOnly, comparing } = relight
</script>

<template>
  <EditorSlider
    :model-value="setup.scene.ambient"
    :label="lc('relight.scene.ambient', locale)"
    @update:model-value="
      (ambient) => relight.updateScene({ ambient }, 'ambient')
    "
  />
  <RelightSwatches
    :model-value="setup.scene.ambientColor"
    :label="lc('relight.scene.ambientColor', locale)"
    :locale
    @update:model-value="
      (ambientColor) => relight.updateScene({ ambientColor })
    "
  />
  <EditorSlider
    :model-value="setup.scene.removeOriginal"
    :label="lc('relight.scene.removeOriginal', locale)"
    @update:model-value="
      (removeOriginal) =>
        relight.updateScene({ removeOriginal }, 'removeOriginal')
    "
  />
  <EditorSlider
    :model-value="setup.scene.reflections"
    :label="lc('relight.scene.reflections', locale)"
    @update:model-value="
      (reflections) => relight.updateScene({ reflections }, 'reflections')
    "
  />
  <EditorSwitch
    v-model="lightOnly"
    :label="lc('relight.view.lightOnly', locale)"
    :disabled="comparing"
  />
</template>

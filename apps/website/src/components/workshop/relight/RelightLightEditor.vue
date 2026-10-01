<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { Light } from '../../../lib/workshop/relight/lights'
import EditorSegmented from '../app-editor/EditorSegmented.vue'
import EditorSlider from '../app-editor/EditorSlider.vue'
import EditorSwitch from '../app-editor/EditorSwitch.vue'
import RelightOrbit from './RelightOrbit.vue'
import RelightSwatches from './RelightSwatches.vue'

const { light, locale = 'en' } = defineProps<{
  light: Light
  locale?: Locale
}>()

const emit = defineEmits<{ change: [patch: Partial<Light>, key?: string] }>()

const kinds = [
  { id: 'point', label: lc('relight.kind.point', locale) },
  { id: 'directional', label: lc('relight.kind.directional', locale) }
] as const
</script>

<template>
  <div
    class="flex flex-col gap-1.5 pt-1.5 pb-2.5"
    data-testid="relight-light-editor"
  >
    <EditorSegmented
      :model-value="light.kind"
      :label="lc('relight.kind', locale)"
      :options="kinds"
      @update:model-value="(kind) => emit('change', { kind })"
    />
    <RelightSwatches
      :model-value="light.color"
      :label="lc('relight.color', locale)"
      :locale
      @update:model-value="(color) => emit('change', { color })"
    />
    <EditorSlider
      :model-value="light.intensity"
      :label="lc('relight.intensity', locale)"
      @update:model-value="
        (intensity) => emit('change', { intensity }, `intensity:${light.id}`)
      "
    />
    <EditorSlider
      v-if="light.kind === 'point'"
      :model-value="light.softness"
      :label="lc('relight.softness', locale)"
      @update:model-value="
        (softness) => emit('change', { softness }, `softness:${light.id}`)
      "
    />
    <template v-else>
      <RelightOrbit
        :light
        :locale
        @change="(patch, key) => emit('change', patch, key)"
      />
      <EditorSlider
        :model-value="light.direction"
        :label="lc('relight.direction', locale)"
        :min="-180"
        :max="180"
        unit="°"
        @update:model-value="
          (direction) => emit('change', { direction }, `direction:${light.id}`)
        "
      />
      <EditorSlider
        :model-value="light.elevation"
        :label="lc('relight.elevation', locale)"
        :min="-90"
        :max="90"
        unit="°"
        @update:model-value="
          (elevation) => emit('change', { elevation }, `elevation:${light.id}`)
        "
      />
    </template>
    <EditorSwitch
      :model-value="light.shadows"
      :label="lc('relight.castShadows', locale)"
      @update:model-value="(shadows) => emit('change', { shadows })"
    />
  </div>
</template>

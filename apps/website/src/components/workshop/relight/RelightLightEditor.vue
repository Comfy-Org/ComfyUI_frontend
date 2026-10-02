<script setup lang="ts">
import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { Light } from '../../../lib/workshop/relight/lights'
import EditorSlider from '../app-editor/EditorSlider.vue'
import EditorSwitch from '../app-editor/EditorSwitch.vue'
import RelightDial from './RelightDial.vue'
import RelightLightKind from './RelightLightKind.vue'
import RelightSwatches from './RelightSwatches.vue'

const {
  relight,
  light,
  locale = 'en'
} = defineProps<{
  relight: Relight
  light: Light
  locale?: Locale
}>()

function change(patch: Partial<Light>, key?: string) {
  relight.updateLight(light.id, patch, key && `${key}:${light.id}`)
}
</script>

<template>
  <div
    class="flex flex-col gap-2 px-2 pt-1 pb-3"
    data-testid="relight-light-editor"
  >
    <RelightLightKind :relight :light :locale />
    <template v-if="light.kind === 'directional'">
      <RelightDial :light :locale @change="change" />
      <EditorSlider
        :model-value="light.elevation"
        :label="lc('relight.elevation', locale)"
        :min="-90"
        :max="90"
        unit="°"
        @update:model-value="(elevation) => change({ elevation }, 'elevation')"
      />
    </template>
    <RelightSwatches
      :model-value="light.color"
      :label="lc('relight.color', locale)"
      :locale
      @update:model-value="(color) => change({ color })"
    />
    <EditorSlider
      :model-value="light.intensity"
      :label="lc('relight.intensity', locale)"
      @update:model-value="(intensity) => change({ intensity }, 'intensity')"
    />
    <EditorSlider
      v-if="light.kind === 'point'"
      :model-value="light.softness"
      :label="lc('relight.softness', locale)"
      @update:model-value="(softness) => change({ softness }, 'softness')"
    />
    <EditorSwitch
      :model-value="light.shadows"
      :label="lc('relight.castShadows', locale)"
      @update:model-value="(shadows) => change({ shadows })"
    />
  </div>
</template>

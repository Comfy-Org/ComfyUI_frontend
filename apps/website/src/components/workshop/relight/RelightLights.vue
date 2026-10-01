<script setup lang="ts">
import { Lightbulb, Sun } from '@lucide/vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import { MAX_LIGHTS } from '../../../lib/workshop/relight/lights'
import EditorMenuButton from '../app-editor/EditorMenuButton.vue'
import RelightLightEditor from './RelightLightEditor.vue'
import RelightLightRow from './RelightLightRow.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { lights, selected, full } = relight
const kinds = [
  { id: 'point', label: lc('relight.kind.point', locale), icon: Lightbulb },
  {
    id: 'directional',
    label: lc('relight.kind.directional', locale),
    icon: Sun
  }
] as const
</script>

<template>
  <ul
    v-if="lights.length"
    class="flex flex-col gap-0.5"
    :aria-label="lc('relight.lights', locale)"
  >
    <RelightLightRow
      v-for="light in lights"
      :key="light.id"
      :light
      :selected="light.id === selected"
      :can-duplicate="!full"
      :locale
      @select="selected = light.id"
      @toggle="relight.updateLight(light.id, { visible: !light.visible })"
      @duplicate="relight.duplicateLight(light.id)"
      @remove="relight.removeLight(light.id)"
    >
      <RelightLightEditor
        v-if="light.id === selected"
        :light
        :locale
        @change="(patch, key) => relight.updateLight(light.id, patch, key)"
      />
    </RelightLightRow>
  </ul>
  <p v-else class="px-1 text-xs text-primary-warm-gray">
    {{ lc('relight.lights.empty', locale) }}
  </p>
  <div class="flex items-center justify-between">
    <EditorMenuButton
      :label="lc('relight.tool.add', locale)"
      :items="kinds"
      :disabled="full"
      @pick="relight.addLight"
    />
    <span class="px-1 text-[11px] text-primary-warm-gray tabular-nums">{{
      lc('relight.lights.count', locale, { n: lights.length, max: MAX_LIGHTS })
    }}</span>
  </div>
</template>

<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed } from 'vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import { MAX_LIGHTS } from '../../../lib/workshop/relight/lights'
import RelightLightEditor from './RelightLightEditor.vue'
import RelightLightRow from './RelightLightRow.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { lights, selected, full } = relight
const current = computed(() =>
  lights.value.find((light) => light.id === selected.value)
)
const adds = [
  {
    kind: 'point',
    text: lc('relight.kind.point', locale),
    label: lc('relight.lights.add.point', locale)
  },
  {
    kind: 'directional',
    text: lc('relight.kind.directional', locale),
    label: lc('relight.lights.add.directional', locale)
  }
] as const
</script>

<template>
  <div class="flex items-center gap-1.5 px-1">
    <button
      v-for="add in adds"
      :key="add.kind"
      type="button"
      :aria-label="add.label"
      :disabled="full"
      class="flex h-7 items-center gap-1 rounded-full border border-primary-comfy-yellow/50 px-2.5 text-[11px] font-medium text-primary-comfy-yellow transition hover:bg-primary-comfy-yellow/10 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      @click="relight.addLight(add.kind)"
    >
      <Plus class="size-3" aria-hidden="true" />
      {{ add.text }}
    </button>
    <span class="flex-1" />
    <span class="text-[11px] text-primary-warm-gray tabular-nums">{{
      lc('relight.lights.count', locale, {
        n: lights.length,
        max: MAX_LIGHTS
      })
    }}</span>
  </div>
  <p v-if="!lights.length" class="px-1 text-xs text-primary-warm-gray">
    {{ lc('relight.lights.empty', locale) }}
  </p>
  <ul
    v-else
    class="flex flex-col gap-1"
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
    />
  </ul>
  <RelightLightEditor
    v-if="current"
    :light="current"
    :locale
    @change="
      (patch, key) => current && relight.updateLight(current.id, patch, key)
    "
  />
  <p class="px-1 text-[11px] text-primary-warm-gray">
    {{ lc('relight.hint', locale) }}
  </p>
</template>

<script setup lang="ts">
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
  <p class="px-1 text-right text-[11px] text-primary-warm-gray tabular-nums">
    {{
      lc('relight.lights.count', locale, { n: lights.length, max: MAX_LIGHTS })
    }}
  </p>
</template>

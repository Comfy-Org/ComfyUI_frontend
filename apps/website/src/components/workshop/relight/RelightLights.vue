<script setup lang="ts">
import { computed, useId } from 'vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { Light } from '../../../lib/workshop/relight/lights'
import RelightLightEditor from './RelightLightEditor.vue'
import RelightLightTabs from './RelightLightTabs.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { lights, selected } = relight
const id = useId()
const ids = { tab: (light: string) => `${id}-${light}`, panel: `${id}-panel` }
const current = computed(() =>
  lights.value.find((light) => light.id === selected.value)
)

function change(patch: Partial<Light>, key?: string) {
  if (current.value) relight.updateLight(current.value.id, patch, key)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <RelightLightTabs :relight :ids :locale />
    <RelightLightEditor
      v-if="current"
      :id="ids.panel"
      role="tabpanel"
      :aria-labelledby="ids.tab(current.id)"
      :light="current"
      :locale
      @change="change"
    />
    <p v-else class="px-1 text-xs text-primary-warm-gray">
      {{ lc('relight.lights.empty', locale) }}
    </p>
  </div>
</template>

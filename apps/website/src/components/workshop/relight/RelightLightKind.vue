<script setup lang="ts">
import { Copy, MoreHorizontal, Trash2 } from '@lucide/vue'
import { computed } from 'vue'

import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import type { Light } from '@/lib/workshop/relight/lights'
import EditorMenuButton from '@/components/workshop/app-editor/EditorMenuButton.vue'
import EditorSegmented from '@/components/workshop/app-editor/EditorSegmented.vue'

const {
  relight,
  light,
  locale = 'en'
} = defineProps<{
  relight: Relight
  light: Light
  locale?: Locale
}>()

const { full } = relight
const kinds = [
  { id: 'point', label: lc('relight.kind.point', locale) },
  { id: 'directional', label: lc('relight.kind.directional', locale) }
] as const
const actions = computed(
  () =>
    [
      {
        id: 'duplicate',
        label: lc('relight.light.duplicate', locale, { name: light.name }),
        icon: Copy,
        disabled: full.value
      },
      {
        id: 'remove',
        label: lc('relight.light.remove', locale, { name: light.name }),
        icon: Trash2
      }
    ] as const
)

function act(id: 'duplicate' | 'remove') {
  if (id === 'duplicate') relight.duplicateLight(light.id)
  else relight.removeLight(light.id)
}
</script>

<template>
  <div class="flex items-center gap-1">
    <EditorSegmented
      :model-value="light.kind"
      :label="lc('relight.kind', locale)"
      :options="kinds"
      class="flex-1"
      @update:model-value="(kind) => relight.updateLight(light.id, { kind })"
    />
    <EditorMenuButton
      :label="lc('relight.light.more', locale, { name: light.name })"
      :items="actions"
      :icon="MoreHorizontal"
      icon-only
      end
      @pick="act"
    />
  </div>
</template>

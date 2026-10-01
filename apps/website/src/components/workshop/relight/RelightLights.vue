<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed } from 'vue'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { Light } from '../../../lib/workshop/relight/lights'
import { MAX_LIGHTS } from '../../../lib/workshop/relight/lights'
import EditorTray from '../app-editor/EditorTray.vue'
import RelightLightEditor from './RelightLightEditor.vue'
import RelightLightRow from './RelightLightRow.vue'

const {
  lights,
  selected,
  locale = 'en'
} = defineProps<{
  lights: readonly Light[]
  selected?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  change: [id: string, patch: Partial<Light>, key?: string]
  remove: [id: string]
  add: []
  close: []
}>()

const current = computed(() => lights.find((light) => light.id === selected))
</script>

<template>
  <EditorTray
    :title="lc('relight.lights', locale)"
    :close-label="lc('relight.close', locale)"
    class="max-w-100"
    @close="emit('close')"
  >
    <template #actions>
      <span class="text-[11px] text-primary-warm-gray">{{
        lc('relight.lights.count', locale, {
          n: lights.length,
          max: MAX_LIGHTS
        })
      }}</span>
      <button
        type="button"
        :disabled="lights.length >= MAX_LIGHTS"
        class="flex h-6 items-center gap-1 rounded-full bg-transparency-white-t8 px-2 text-[11px] text-primary-warm-white hover:bg-transparency-white-t20 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
        @click="emit('add')"
      >
        <Plus class="size-3" aria-hidden="true" />
        {{ lc('relight.lights.add', locale) }}
      </button>
    </template>
    <p v-if="!lights.length" class="px-2 py-1 text-xs text-primary-warm-gray">
      {{ lc('relight.lights.empty', locale) }}
    </p>
    <ul v-else class="flex flex-col gap-px">
      <RelightLightRow
        v-for="light in lights"
        :key="light.id"
        :light
        :selected="light.id === selected"
        :locale
        @select="emit('select', light.id)"
        @toggle="emit('change', light.id, { visible: !light.visible })"
        @remove="emit('remove', light.id)"
      />
    </ul>
    <RelightLightEditor
      v-if="current"
      :light="current"
      :locale
      @change="
        (patch, key) => current && emit('change', current.id, patch, key)
      "
    />
  </EditorTray>
</template>

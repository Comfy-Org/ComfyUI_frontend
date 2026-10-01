<script setup lang="ts">
import { Plus } from '@lucide/vue'

import type { Locale } from '../../../i18n/translations'
import type { MoveObject } from '../../../lib/workshop/move-anything/arrange'
import { MAX_OBJECTS } from '../../../lib/workshop/move-anything/arrange'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorTray from '../app-editor/EditorTray.vue'
import MoveAnythingObjectList from './MoveAnythingObjectList.vue'

const {
  objects,
  selected,
  locale = 'en'
} = defineProps<{
  objects: readonly MoveObject[]
  selected?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
  rename: [id: string, label: string]
  add: []
  close: []
}>()
</script>

<template>
  <EditorTray
    :title="mc('move.objects', locale)"
    :close-label="mc('move.close', locale)"
    class="max-w-95"
    @close="emit('close')"
  >
    <template #actions>
      <span class="text-[11px] text-primary-warm-gray">{{
        mc('move.objects.count', locale, {
          n: objects.length,
          max: MAX_OBJECTS
        })
      }}</span>
    </template>
    <MoveAnythingObjectList
      :objects
      :selected
      :locale
      @select="(id) => emit('select', id)"
      @remove="(id) => emit('remove', id)"
      @rename="(id, label) => emit('rename', id, label)"
    />
    <button
      type="button"
      :disabled="objects.length >= MAX_OBJECTS"
      class="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-transparency-white-t20 text-[11px] text-primary-warm-gray transition hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-50"
      @click="emit('add')"
    >
      <Plus class="size-3" aria-hidden="true" />
      {{
        objects.length >= MAX_OBJECTS
          ? mc('move.objects.full', locale, { max: MAX_OBJECTS })
          : mc('move.objects.add', locale)
      }}
    </button>
  </EditorTray>
</template>

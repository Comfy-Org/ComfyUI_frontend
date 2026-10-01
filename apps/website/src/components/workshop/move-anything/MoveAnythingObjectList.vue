<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { MoveObject } from '../../../lib/workshop/move-anything/arrange'
import { mc } from '../../../lib/workshop/move-anything/copy'
import MoveAnythingObjectRow from './MoveAnythingObjectRow.vue'

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
}>()
</script>

<template>
  <p v-if="!objects.length" class="px-1 text-xs text-primary-warm-gray">
    {{ mc('move.objects.empty', locale) }}
  </p>
  <ul
    v-else
    class="flex flex-col gap-0.5"
    :aria-label="mc('move.objects', locale)"
  >
    <MoveAnythingObjectRow
      v-for="(object, index) in objects"
      :key="object.id"
      :object
      :index
      :selected="object.id === selected"
      :locale
      @select="emit('select', object.id)"
      @remove="emit('remove', object.id)"
      @rename="(label) => emit('rename', object.id, label)"
    />
  </ul>
</template>

<script setup lang="ts">
import type { useMoveAnything } from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import MoveAnythingObjects from './MoveAnythingObjects.vue'

const { move, locale = 'en' } = defineProps<{
  move: ReturnType<typeof useMoveAnything>
  locale?: Locale
}>()

const { objects, selected, tray, tool } = move
</script>

<template>
  <MoveAnythingObjects
    v-if="tray === 'objects'"
    :objects
    :selected
    :locale
    @select="(id) => (selected = id)"
    @remove="move.remove"
    @add="tool = 'smart'"
    @rename="move.rename"
    @close="tray = undefined"
  />
</template>

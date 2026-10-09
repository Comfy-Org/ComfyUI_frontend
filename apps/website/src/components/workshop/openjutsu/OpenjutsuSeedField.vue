<script setup lang="ts">
import { Dices } from '@lucide/vue'
import { useId } from 'vue'

import EditorIconButton from '@/components/workshop/app-editor/EditorIconButton.vue'

/** The kit's seed field, except that an empty seed means a new one every take. */
const { label, randomLabel, shuffleLabel } = defineProps<{
  label: string
  randomLabel: string
  shuffleLabel: string
}>()
const seed = defineModel<number | undefined>()
const id = useId()

function onChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = Number.parseFloat(event.target.value)
  seed.value = Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : undefined
}

function shuffle() {
  seed.value = Math.floor(Math.random() * 1_000_000_000)
}
</script>

<template>
  <div
    class="flex h-10 items-center gap-1 rounded-xl border border-transparency-white-t8 pr-1 pl-3 hover:border-transparency-white-t20"
  >
    <label :for="id" class="shrink-0 text-sm text-primary-warm-gray">{{
      label
    }}</label>
    <input
      :id
      :value="seed ?? ''"
      type="number"
      min="0"
      step="1"
      :placeholder="randomLabel"
      class="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm text-primary-warm-white tabular-nums outline-none placeholder:text-primary-warm-gray/60 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50"
      @change="onChange"
    />
    <EditorIconButton :icon="Dices" :label="shuffleLabel" @click="shuffle" />
  </div>
</template>

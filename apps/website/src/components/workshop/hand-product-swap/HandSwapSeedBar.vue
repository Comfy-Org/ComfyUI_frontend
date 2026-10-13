<script setup lang="ts">
import { Dices } from '@lucide/vue'
import { useId } from 'vue'

import EditorIconButton from '@/components/workshop/app-editor/EditorIconButton.vue'

/** The seed as a field of the panel's format bar, the height of its menus. */
const { label, shuffleLabel } = defineProps<{
  label: string
  shuffleLabel: string
}>()
const seed = defineModel<number>({ required: true })
const id = useId()

function onChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const next = Math.round(Number(event.target.value))
  if (Number.isFinite(next) && next >= 0) seed.value = next
  else event.target.value = String(seed.value)
}

function shuffle() {
  seed.value = Math.floor(Math.random() * 1_000_000_000)
}
</script>

<template>
  <div
    class="flex h-10 items-center gap-1 rounded-xl border border-transparency-white-t8 pr-1 pl-3 hover:border-transparency-white-t20"
  >
    <label :for="id" class="sr-only">{{ label }}</label>
    <input
      :id
      :value="seed"
      type="number"
      min="0"
      step="1"
      class="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm text-primary-warm-white tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-40"
      @change="onChange"
    />
    <EditorIconButton :icon="Dices" :label="shuffleLabel" @click="shuffle" />
  </div>
</template>

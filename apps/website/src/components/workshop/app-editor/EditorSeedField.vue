<script setup lang="ts">
import { Dices } from '@lucide/vue'

import EditorIconButton from './EditorIconButton.vue'
import EditorNumberField from './EditorNumberField.vue'

const { label, shuffleLabel } = defineProps<{
  label: string
  shuffleLabel: string
}>()
const seed = defineModel<number>({ required: true })

function shuffle() {
  seed.value = Math.floor(Math.random() * 1_000_000_000)
}
</script>

<template>
  <div class="flex items-center gap-1">
    <EditorNumberField v-model="seed" :label class="min-w-0 flex-1" />
    <EditorIconButton :icon="Dices" :label="shuffleLabel" @click="shuffle" />
  </div>
</template>

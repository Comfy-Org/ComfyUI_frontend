<template>
  <span>
    <template v-if="keyCombo">
      <template v-for="(sequence, index) in keySequences" :key="index">
        <Tag :severity="isModified ? 'info' : 'secondary'">
          {{ sequence }}
        </Tag>
        <span v-if="index < keySequences.length - 1" class="px-2">+</span>
      </template>
    </template>
    <span v-else>-</span>
  </span>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'
import { KeyComboImpl } from '@/stores/keybindingStore'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    keyCombo: KeyComboImpl | null
    isModified: boolean
  }>(),
  {
    isModified: false
  }
)

const keySequences = computed(() => props.keyCombo?.getKeySequences() ?? [])
</script>

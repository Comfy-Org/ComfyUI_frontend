<template>
  <span>
    <template v-for="(sequence, index) in keySequences" :key="index">
      <Tag :severity="isModified ? 'info' : 'secondary'">
        {{ sequence }}
      </Tag>
      <span v-if="index < keySequences.length - 1" class="px-2">+</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'
import { computed } from 'vue'

import { KeyComboImpl } from '@/stores/keybindingStore'

const props = withDefaults(
  defineProps<{
    keyCombo: KeyComboImpl
    isModified: boolean
  }>(),
  {
    isModified: false
  }
)

const keySequences = computed(() => props.keyCombo.getKeySequences())
</script>

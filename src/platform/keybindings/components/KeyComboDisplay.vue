<template>
  <span class="flex gap-0.5">
    <template v-for="(sequence, index) in keySequences" :key="index">
      <Badge
        class="min-w-6 bg-muted text-center font-normal capitalize"
        :severity="isModified ? 'info' : 'secondary'"
      >
        {{ sequence }}
      </Badge>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Badge from '@comfyorg/design-system/badge/Badge'
import type { KeyComboImpl } from '@comfyorg/keybindings/keyCombo'

const { keyCombo, isModified = false } = defineProps<{
  keyCombo: KeyComboImpl
  isModified?: boolean
}>()

const keySequences = computed(() => keyCombo.getKeySequences())
</script>

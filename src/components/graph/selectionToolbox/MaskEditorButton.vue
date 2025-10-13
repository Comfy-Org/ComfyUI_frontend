<template>
  <Button
    v-show="isSingleImageNode"
    v-tooltip.top="{
      value: t('commands.Comfy_MaskEditor_OpenMaskEditor.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    @click="openMaskEditor"
  >
    <i-comfy:mask class="!h-4 !w-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { t } from '@/i18n'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
const { isSingleImageNode } = useSelectionState()

const openMaskEditor = () => {
  void commandStore.execute('Comfy.MaskEditor.OpenMaskEditor')
}
</script>

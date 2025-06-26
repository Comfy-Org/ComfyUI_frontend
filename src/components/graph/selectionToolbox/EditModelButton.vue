<template>
  <Button
    v-show="isImageOutputSelected"
    v-tooltip.top="{
      value: t('commands.Comfy_Canvas_AddEditModelStep.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    icon="pi pi-pen-to-square"
    @click="() => commandStore.execute('Comfy.Canvas.AddEditModelStep')"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { isImageNode, isLGraphNode } from '@/utils/litegraphUtil'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

const isImageOutputOrEditModelNode = (node: unknown) =>
  isLGraphNode(node) &&
  (isImageNode(node) || node.type === 'workflow>FLUX.1 Kontext Image Edit')

const isImageOutputSelected = computed(
  () =>
    canvasStore.selectedItems.length === 1 &&
    isImageOutputOrEditModelNode(canvasStore.selectedItems[0])
)
</script>

<template>
  <Button
    v-show="canvasStore.nodeSelected || canvasStore.groupSelected"
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
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
</script>

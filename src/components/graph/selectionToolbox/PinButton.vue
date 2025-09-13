<template>
  <Button
    v-show="canvasStore.nodeSelected || canvasStore.groupSelected"
    v-tooltip.top="{
      value: t('commands.Comfy_Canvas_ToggleSelectedNodes_Pin.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    icon="pi pi-thumbtack"
    @click="() => commandStore.execute('Comfy.Canvas.ToggleSelected.Pin')"
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

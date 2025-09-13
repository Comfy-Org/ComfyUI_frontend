<template>
  <Button
    v-show="isDeletable"
    v-tooltip.top="{
      value: t('commands.Comfy_Canvas_DeleteSelectedItems.label'),
      showDelay: 1000
    }"
    severity="danger"
    text
    icon="pi pi-trash"
    @click="() => commandStore.execute('Comfy.Canvas.DeleteSelectedItems')"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

const isDeletable = computed(() =>
  canvasStore.selectedItems.some((x) => x.removable !== false)
)
</script>

<template>
  <Button
    v-show="isDeletable"
    v-tooltip.top="{
      value: t('commands.Comfy_Canvas_DeleteSelectedItems.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    icon-class="size-4"
    icon="pi pi-trash"
    data-testid="delete-button"
    @click="() => commandStore.execute('Comfy.Canvas.DeleteSelectedItems')"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const { isDeletable } = useSelectionState()
</script>

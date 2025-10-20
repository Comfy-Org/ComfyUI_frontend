<template>
  <Button
    v-show="isDeletable"
    v-tooltip.top="{
      value: t('commands.Comfy_Canvas_DeleteSelectedItems.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    icon-class="w-4 h-4"
    icon="pi pi-trash"
    data-testid="delete-button"
    @click="() => commandStore.execute('Comfy.Canvas.DeleteSelectedItems')"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const { selectedItems } = useSelectionState()

const isDeletable = computed(() =>
  selectedItems.value.some((x: Positionable) => x.removable !== false)
)
</script>

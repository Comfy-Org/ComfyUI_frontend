<template>
  <Tooltip
    :config="{
      value: $t('commands.Comfy_Canvas_DeleteSelectedItems.label'),
      showDelay: 1000
    }"
    side="top"
  >
    <Button
      v-show="isDeletable"
      variant="muted-textonly"
      :aria-label="$t('commands.Comfy_Canvas_DeleteSelectedItems.label')"
      data-testid="delete-button"
      @click="() => commandStore.execute('Comfy.Canvas.DeleteSelectedItems')"
    >
      <i class="icon-[lucide--trash-2]" />
    </Button>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
const { selectedItems } = useSelectionState()

const isDeletable = computed(() =>
  selectedItems.value.some((x: Positionable) => x.removable !== false)
)
</script>

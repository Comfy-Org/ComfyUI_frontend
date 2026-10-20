<template>
  <Button
    v-if="linksHidden"
    :tooltip="$t('commands.Comfy_Canvas_ShowSelectedLinks.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_Canvas_ShowSelectedLinks.label')"
    data-testid="show-links-button"
    @click="() => commandStore.execute('Comfy.Canvas.ShowSelectedLinks')"
  >
    <i class="icon-[lucide--eye]" />
  </Button>
  <Button
    v-else
    :tooltip="$t('commands.Comfy_Canvas_HideSelectedLinks.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_Canvas_HideSelectedLinks.label')"
    data-testid="hide-links-button"
    @click="() => commandStore.execute('Comfy.Canvas.HideSelectedLinks')"
  >
    <i class="icon-[lucide--eye-off]" />
  </Button>
  <Button
    :tooltip="$t('commands.Comfy_Canvas_DeleteSelectedLinks.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_Canvas_DeleteSelectedLinks.label')"
    data-testid="delete-links-button"
    @click="() => commandStore.execute('Comfy.Canvas.DeleteSelectedLinks')"
  >
    <i class="icon-[lucide--trash-2]" />
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { areSelectedLinksHidden } from '@/lib/litegraph/src/canvas/linkSelection'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'

const commandStore = useCommandStore()
const linkSelectionStore = useLinkSelectionStore()
const canvasStore = useCanvasStore()

const linksHidden = computed(() => {
  if (!linkSelectionStore.selection) return false
  const graph = canvasStore.canvas?.graph
  return !!graph && areSelectedLinksHidden(graph)
})
</script>

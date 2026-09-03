<template>
  <Tooltip
    :config="{
      value: $t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label'),
      showDelay: 1000
    }"
    side="top"
  >
    <Button
      variant="muted-textonly"
      :aria-label="$t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label')"
      data-testid="bypass-button"
      class="hover:bg-secondary-background"
      @click="toggleBypass"
    >
      <i class="icon-[lucide--redo-dot] size-4" />
    </Button>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import Button from '@/components/ui/button/Button.vue'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()

const toggleBypass = async () => {
  await commandStore.execute('Comfy.Canvas.ToggleSelectedNodes.Bypass')
}
</script>

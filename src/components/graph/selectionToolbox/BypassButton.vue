<template>
  <Button
    :tooltip="$t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label')"
    data-testid="bypass-button"
    class="hover:bg-secondary"
    @click="toggleBypass"
  >
    <i class="icon-[lucide--redo-dot]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()

const toggleBypass = async () => {
  await commandStore.execute('Comfy.Canvas.ToggleSelectedNodes.Bypass')
}
</script>

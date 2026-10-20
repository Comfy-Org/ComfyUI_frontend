<template>
  <Button
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
import Button from '@/components/ui/button/Button.vue'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
</script>

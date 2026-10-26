<template>
  <Button
    :tooltip="$t('commands.Comfy_PublishSubgraph.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_PublishSubgraph.label')"
    @click="() => commandStore.execute('Comfy.PublishSubgraph')"
  >
    <i class="icon-[lucide--book-open] size-[1.2em]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
</script>

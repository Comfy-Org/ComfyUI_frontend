<template>
  <Button
    :tooltip="$t('commands.Comfy_PublishSubgraph.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_PublishSubgraph.label')"
    @click="() => commandStore.execute('Comfy.PublishSubgraph')"
  >
    <i class="icon-[lucide--book-open]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
</script>

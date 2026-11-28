<template>
  <Button
    v-if="promptPanelStore.isActive"
    variant="muted-textonly"
    size="md"
    @click="promptPanelStore.isPromptViewShown = true"
  >
    <i class="icon-[lucide--text-cursor-input]" />
    {{ $t('textEditor.prompt') }}
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { usePromptPanelStore } from '@/renderer/extensions/textEditor/promptPanelStore'

const promptPanelStore = usePromptPanelStore()
</script>

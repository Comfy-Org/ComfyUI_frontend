<template>
  <Button
    v-for="tool in extensionTools.tools.value"
    :key="tool.id"
    type="button"
    variant="textonly"
    size="unset"
    :aria-label="tool.label"
    :aria-pressed="extensionTools.active.value?.tool.id === tool.id"
    :title="tool.label"
    :data-tool="tool.id"
    :class="
      cn(
        'maskEditor_toolPanelContainer rounded-none',
        extensionTools.active.value?.tool.id === tool.id &&
          'maskEditor_toolPanelContainerSelected'
      )
    "
    @click="extensionTools.activate(tool.id)"
  >
    <i
      :class="cn('size-6', tool.icon ?? 'icon-[lucide--puzzle]')"
      aria-hidden="true"
    />
    <span class="maskEditor_toolPanelIndicator" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import type { MaskEditorExtensionTools } from '@/renderer/extensions/maskEditor/composables/useMaskEditorExtensionTools'

const { extensionTools } = defineProps<{
  extensionTools: MaskEditorExtensionTools
}>()
</script>

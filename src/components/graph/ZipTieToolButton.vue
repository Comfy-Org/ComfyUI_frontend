<template>
  <Button
    variant="secondary"
    :tooltip="t('zipTie.toolHint')"
    :aria-label="t('zipTie.tool')"
    :aria-pressed="zipTieTool.active"
    :disabled="canvasStore.isReadOnly"
    :style="buttonStyles"
    class="bg-transparent px-2 transition-none aria-pressed:bg-muted"
    @click="commandStore.execute('Comfy.Canvas.ToggleZipTieTool')"
  >
    <i class="icon-[lucide--cable]" aria-hidden="true" />
    <span>{{ t('zipTie.tool') }}</span>
  </Button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useZipTieToolStore } from './zipTieToolStore'

defineProps<{ buttonStyles?: Record<string, string> }>()

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const zipTieTool = useZipTieToolStore()
</script>

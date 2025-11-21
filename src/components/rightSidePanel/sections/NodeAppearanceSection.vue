<template>
  <div class="node-appearance-section">
    <div
      class="mb-2 text-xs font-semibold uppercase tracking-wider text-base-foreground-muted"
    >
      {{ $t('rightSidePanel.appearance') }}
    </div>
    <div class="space-y-3 rounded-lg bg-interface-surface p-3">
      <!-- Color Picker -->
      <div class="flex items-center justify-between">
        <span class="text-sm">{{ $t('rightSidePanel.color') }}</span>
        <Button
          text
          rounded
          severity="secondary"
          size="small"
          class="relative"
          @click="showColorPicker = !showColorPicker"
        >
          <div
            class="h-4 w-4 rounded border border-interface-stroke"
            :style="{ backgroundColor: currentColor }"
          />
        </Button>
      </div>

      <!-- Color Picker Popover -->
      <Popover
        v-model:visible="showColorPicker"
        :append-to="'body'"
        :dismissable="true"
      >
        <div class="p-2">
          <ColorPicker
            v-model="currentColor"
            format="hex"
            @update:model-value="onColorChange"
          />
        </div>
      </Popover>

      <!-- Pinned Toggle -->
      <div class="flex items-center justify-between">
        <span class="text-sm">{{ $t('rightSidePanel.pinned') }}</span>
        <ToggleSwitch v-model="isPinned" @update:model-value="onPinnedChange" />
      </div>

      <!-- Bypass Toggle -->
      <div class="flex items-center justify-between">
        <span class="text-sm">{{ $t('rightSidePanel.bypass') }}</span>
        <ToggleSwitch
          v-model="isBypassed"
          @update:model-value="onBypassChange"
        />
      </div>

      <!-- Mute Toggle -->
      <div class="flex items-center justify-between">
        <span class="text-sm">{{ $t('rightSidePanel.mute') }}</span>
        <ToggleSwitch v-model="isMuted" @update:model-value="onMuteChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'
import Popover from 'primevue/popover'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

const props = defineProps<{
  node?: LGraphNode
  nodes?: LGraphNode[]
}>()

const canvasStore = useCanvasStore()
const showColorPicker = ref(false)

// Get the target nodes array
const targetNodes = computed(() => {
  if (props.node) return [props.node]
  return props.nodes || []
})

// Current color (for single node)
const currentColor = computed({
  get() {
    if (props.node) {
      return props.node.color || '#353535'
    }
    // For multiple nodes, show the first node's color
    return targetNodes.value[0]?.color || '#353535'
  },
  set(_value: string) {
    // Will be handled by onColorChange
  }
})

// Pinned state
const isPinned = computed({
  get() {
    return targetNodes.value.some((node) => node.pinned)
  },
  set(_value: boolean) {
    // Will be handled by onPinnedChange
  }
})

// Bypassed state
const isBypassed = computed({
  get() {
    return targetNodes.value.some(
      (node) => node.mode === LGraphEventMode.BYPASS
    )
  },
  set(_value: boolean) {
    // Will be handled by onBypassChange
  }
})

// Muted state
const isMuted = computed({
  get() {
    return targetNodes.value.some((node) => node.mode === LGraphEventMode.NEVER)
  },
  set(_value: boolean) {
    // Will be handled by onMuteChange
  }
})

function onColorChange(color: string) {
  targetNodes.value.forEach((node) => {
    node.color = color
  })
  canvasStore.canvas?.setDirty(true, true)
}

function onPinnedChange(value: boolean) {
  targetNodes.value.forEach((node) => {
    node.pin(value)
  })
  canvasStore.canvas?.setDirty(true, true)
}

function onBypassChange(value: boolean) {
  targetNodes.value.forEach((node) => {
    node.mode = value ? LGraphEventMode.BYPASS : LGraphEventMode.ALWAYS
  })
  canvasStore.canvas?.setDirty(true, true)
}

function onMuteChange(value: boolean) {
  targetNodes.value.forEach((node) => {
    node.mode = value ? LGraphEventMode.NEVER : LGraphEventMode.ALWAYS
  })
  canvasStore.canvas?.setDirty(true, true)
}
</script>

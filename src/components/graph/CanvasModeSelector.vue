<template>
  <Button
    ref="buttonRef"
    severity="secondary"
    class="group h-8 bg-interface-panel-surface p-0 hover:bg-button-hover-surface!"
    :style="buttonStyles"
    @click="toggle"
  >
    <template #default>
      <div class="flex items-center gap-1 pr-0.5">
        <div
          class="rounded bg-button-active-surface p-2 group-hover:bg-button-hover-surface"
        >
          <i :class="currentModeIcon" class="block h-4 w-4" />
        </div>
        <i class="icon-[lucide--chevron-down] block h-4 w-4 pr-1.5" />
      </div>
    </template>
  </Button>

  <Popover
    ref="popover"
    :auto-z-index="true"
    :base-z-index="1000"
    :dismissable="true"
    :close-on-escape="true"
    unstyled
    :pt="popoverPt"
  >
    <div class="flex flex-col gap-1">
      <div
        class="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm hover:bg-gray-100 dark-theme:hover:bg-zinc-700"
        @click="setMode('select')"
      >
        <div class="flex items-center gap-2">
          <i class="icon-[lucide--mouse-pointer-2] h-4 w-4" />
          <span>{{ $t('graphCanvasMenu.select') }}</span>
        </div>
        <span class="text-gray-500">{{ unlockCommandText }}</span>
      </div>

      <div
        class="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm hover:bg-gray-100 dark-theme:hover:bg-zinc-700"
        @click="setMode('hand')"
      >
        <div class="flex items-center gap-2">
          <i class="icon-[lucide--hand] h-4 w-4" />
          <span>{{ $t('graphCanvasMenu.hand') }}</span>
        </div>
        <span class="text-gray-500">{{ lockCommandText }}</span>
      </div>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

interface Props {
  buttonStyles?: Record<string, string>
}

defineProps<Props>()
const buttonRef = ref<InstanceType<typeof Button>>()
const popover = ref<InstanceType<typeof Popover>>()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

const isCanvasReadOnly = computed(() => canvasStore.canvas?.read_only ?? false)

const currentModeIcon = computed(() =>
  isCanvasReadOnly.value
    ? 'icon-[lucide--hand]'
    : 'icon-[lucide--mouse-pointer-2]'
)

const unlockCommandText = computed(() =>
  commandStore
    .formatKeySequence(commandStore.getCommand('Comfy.Canvas.Unlock'))
    .toUpperCase()
)

const lockCommandText = computed(() =>
  commandStore
    .formatKeySequence(commandStore.getCommand('Comfy.Canvas.Lock'))
    .toUpperCase()
)

const toggle = (event: Event) => {
  const el = (buttonRef.value as any)?.$el || buttonRef.value
  popover.value?.toggle(event, el)
}

const setMode = (mode: 'select' | 'hand') => {
  if (mode === 'select' && isCanvasReadOnly.value) {
    void commandStore.execute('Comfy.Canvas.Unlock')
  } else if (mode === 'hand' && !isCanvasReadOnly.value) {
    void commandStore.execute('Comfy.Canvas.Lock')
  }
  popover.value?.hide()
}

const popoverPt = computed(() => ({
  root: {
    class: 'absolute z-50',
    style: 'transform: translateY(-8px);'
  },
  content: {
    class: [
      'mb-2 text-neutral dark-theme:text-white',
      'shadow-lg border border-node-border',
      'bg-nav-background',
      'rounded-lg',
      'p-2 px-3',
      'min-w-[156px]',
      'select-none'
    ]
  }
}))
</script>

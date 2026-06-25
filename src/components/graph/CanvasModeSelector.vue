<template>
  <DropdownMenu v-model:open="isOpen" :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        variant="secondary"
        class="group h-8 rounded-none! bg-comfy-menu-bg p-0 transition-none! hover:rounded-lg! hover:bg-interface-button-hover-surface!"
        :style="buttonStyles"
        :aria-label="$t('graphCanvasMenu.canvasMode')"
      >
        <div class="flex items-center gap-1 pr-0.5">
          <div
            class="rounded-lg bg-interface-panel-selected-surface p-2 group-hover:bg-interface-button-hover-surface"
          >
            <i
              :class="currentModeIcon"
              class="block size-4"
              aria-hidden="true"
            />
          </div>
          <i
            class="icon-[lucide--chevron-down] block size-4 pr-1.5"
            aria-hidden="true"
          />
        </div>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      size="lg"
      :side-offset="4"
      align="start"
      :aria-label="$t('graphCanvasMenu.canvasMode')"
    >
      <DropdownMenuItem
        checkable
        :checked="!isCanvasReadOnly"
        @select="setMode('select')"
      >
        <template #icon><i class="icon-[lucide--mouse-pointer-2]" /></template>
        {{ $t('graphCanvasMenu.select') }}
        <DropdownMenuShortcut>{{ unlockCommandText }}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem
        checkable
        :checked="isCanvasReadOnly"
        @select="setMode('hand')"
      >
        <template #icon><i class="icon-[lucide--hand]" /></template>
        {{ $t('graphCanvasMenu.hand') }}
        <DropdownMenuShortcut>{{ lockCommandText }}</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuShortcut from '@/components/ui/dropdown-menu/DropdownMenuShortcut.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

interface Props {
  buttonStyles?: Record<string, string>
}

defineProps<Props>()

const isOpen = ref(false)
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

const setMode = (mode: 'select' | 'hand') => {
  if (mode === 'select' && isCanvasReadOnly.value) {
    void commandStore.execute('Comfy.Canvas.Unlock')
  } else if (mode === 'hand' && !isCanvasReadOnly.value) {
    void commandStore.execute('Comfy.Canvas.Lock')
  }
}
</script>

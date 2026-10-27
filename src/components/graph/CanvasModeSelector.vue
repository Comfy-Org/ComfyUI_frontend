<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        ref="buttonRef"
        variant="secondary"
        class="group rounded-none! bg-transparent p-0 transition-none! hover:rounded-lg! hover:bg-accent!"
        :style="buttonStyles"
        :aria-label="$t('graphCanvasMenu.canvasMode')"
        aria-haspopup="menu"
        :aria-expanded="isOpen"
      >
        <div class="flex items-center gap-1 pr-0.5">
          <div class="rounded-lg bg-muted p-2 group-hover:bg-accent">
            <i :class="currentModeIcon" class="block" aria-hidden="true" />
          </div>
          <i
            class="icon-[lucide--chevron-down] block pr-1.5"
            aria-hidden="true"
          />
        </div>
      </Button>
    </PopoverTrigger>

    <PopoverContent
      side="top"
      :side-offset="8"
      :class="
        cn(
          menuContentClass,
          'max-h-(--reka-popover-content-available-height) w-auto max-w-(--reka-popover-content-available-width) min-w-39 select-none data-[state=closed]:animate-none data-[state=open]:animate-none'
        )
      "
      @open-auto-focus.prevent="onPopoverShow"
    >
      <div
        ref="menuRef"
        class="flex flex-col"
        role="menu"
        :aria-label="$t('graphCanvasMenu.canvasMode')"
      >
        <button
          type="button"
          role="menuitemradio"
          :aria-checked="!isCanvasReadOnly"
          :tabindex="!isCanvasReadOnly ? 0 : -1"
          :class="cn(menuButtonClass, 'justify-between')"
          :aria-label="$t('graphCanvasMenu.select')"
          @click="setMode('select')"
          @keydown.arrow-down.prevent="focusNextItem"
          @keydown.arrow-up.prevent="focusPrevItem"
          @keydown.escape.prevent="closeAndRestoreFocus"
        >
          <div class="flex items-center gap-2">
            <i class="icon-[lucide--mouse-pointer-2]" aria-hidden="true" />
            <span>{{ $t('graphCanvasMenu.select') }}</span>
          </div>
          <span
            class="text-[9px] text-foreground"
            data-testid="shortcut-hint"
            >{{ unlockCommandText }}</span
          >
        </button>

        <button
          type="button"
          role="menuitemradio"
          :aria-checked="isCanvasReadOnly"
          :tabindex="isCanvasReadOnly ? 0 : -1"
          :class="cn(menuButtonClass, 'justify-between')"
          :aria-label="$t('graphCanvasMenu.hand')"
          @click="setMode('hand')"
          @keydown.arrow-down.prevent="focusNextItem"
          @keydown.arrow-up.prevent="focusPrevItem"
          @keydown.escape.prevent="closeAndRestoreFocus"
        >
          <div class="flex items-center gap-2">
            <i class="icon-[lucide--hand]" aria-hidden="true" />
            <span>{{ $t('graphCanvasMenu.hand') }}</span>
          </div>
          <span
            class="text-[9px] text-foreground"
            data-testid="shortcut-hint"
            >{{ lockCommandText }}</span
          >
        </button>
      </div>
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { unrefElement } from '@vueuse/core'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { usePopoverViewportDismiss } from '@comfyorg/design-system/lib/popover/usePopoverViewportDismiss'
import {
  menuButtonClass,
  menuContentClass
} from '@comfyorg/design-system/lib/menu/menuStyles'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'
import { cn } from '@comfyorg/tailwind-utils'

interface Props {
  buttonStyles?: Record<string, string>
}

defineProps<Props>()
const buttonRef = ref<ComponentPublicInstance | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
usePopoverViewportDismiss(isOpen, () => unrefElement(buttonRef))
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
  isOpen.value = false
}

async function onPopoverShow() {
  await nextTick()
  const checkedItem = menuRef.value?.querySelector<HTMLElement>(
    '[aria-checked="true"]'
  )
  checkedItem?.focus()
}

function closeAndRestoreFocus() {
  isOpen.value = false
  unrefElement(buttonRef)?.focus()
}

function focusNextItem(event: KeyboardEvent) {
  const items = getMenuItems(event)
  const index = items.indexOf(event.target as HTMLElement)
  items[(index + 1) % items.length]?.focus()
}

function focusPrevItem(event: KeyboardEvent) {
  const items = getMenuItems(event)
  const index = items.indexOf(event.target as HTMLElement)
  items[(index - 1 + items.length) % items.length]?.focus()
}

function getMenuItems(event: KeyboardEvent): HTMLElement[] {
  const menu = (event.target as HTMLElement).closest('[role="menu"]')
  if (!menu) return []
  return Array.from(menu.querySelectorAll('[role="menuitemradio"]'))
}
</script>

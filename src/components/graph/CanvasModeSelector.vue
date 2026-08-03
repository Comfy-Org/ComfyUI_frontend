<template>
  <Button
    ref="buttonRef"
    variant="secondary"
    class="group h-8 rounded-none! bg-comfy-menu-bg p-0 transition-none! hover:rounded-lg! hover:bg-interface-button-hover-surface!"
    :style="buttonStyles"
    :aria-label="$t('graphCanvasMenu.canvasMode')"
    aria-haspopup="menu"
    :aria-expanded="isOpen"
    @click="toggle"
  >
    <div class="flex items-center gap-1 pr-0.5">
      <div
        class="rounded-lg bg-interface-panel-selected-surface p-2 group-hover:bg-interface-button-hover-surface"
      >
        <i :class="currentModeIcon" class="block size-4" aria-hidden="true" />
      </div>
      <i
        class="icon-[lucide--chevron-down] block size-4 pr-1.5"
        aria-hidden="true"
      />
    </div>
  </Button>

  <Popover
    ref="popover"
    :auto-z-index="true"
    :base-z-index="1000"
    :dismissable="true"
    :close-on-escape="true"
    unstyled
    :pt="popoverPt"
    @show="onPopoverShow"
    @hide="onPopoverHide"
  >
    <div
      ref="menuRef"
      class="flex flex-col gap-1"
      role="menu"
      :aria-label="$t('graphCanvasMenu.canvasMode')"
    >
      <button
        type="button"
        role="menuitemradio"
        :aria-checked="!isCanvasReadOnly"
        :tabindex="!isCanvasReadOnly ? 0 : -1"
        class="flex w-full cursor-pointer items-center justify-between rounded-sm border-none bg-transparent px-3 py-2 text-sm text-text-primary outline-none hover:bg-node-component-surface-hovered focus-visible:bg-node-component-surface-hovered"
        :aria-label="$t('graphCanvasMenu.select')"
        @click="setMode('select')"
        @keydown.arrow-down.prevent="focusNextItem"
        @keydown.arrow-up.prevent="focusPrevItem"
        @keydown.escape.prevent="closeAndRestoreFocus"
      >
        <div class="flex items-center gap-2">
          <i class="icon-[lucide--mouse-pointer-2] size-4" aria-hidden="true" />
          <span>{{ $t('graphCanvasMenu.select') }}</span>
        </div>
        <span
          class="text-[9px] text-text-primary"
          data-testid="shortcut-hint"
          >{{ unlockCommandText }}</span
        >
      </button>

      <button
        type="button"
        role="menuitemradio"
        :aria-checked="isCanvasReadOnly"
        :tabindex="isCanvasReadOnly ? 0 : -1"
        class="flex w-full cursor-pointer items-center justify-between rounded-sm border-none bg-transparent px-3 py-2 text-sm text-text-primary outline-none hover:bg-node-component-surface-hovered focus-visible:bg-node-component-surface-hovered"
        :aria-label="$t('graphCanvasMenu.hand')"
        @click="setMode('hand')"
        @keydown.arrow-down.prevent="focusNextItem"
        @keydown.arrow-up.prevent="focusPrevItem"
        @keydown.escape.prevent="closeAndRestoreFocus"
      >
        <div class="flex items-center gap-2">
          <i class="icon-[lucide--hand] size-4" aria-hidden="true" />
          <span>{{ $t('graphCanvasMenu.hand') }}</span>
        </div>
        <span
          class="text-[9px] text-text-primary"
          data-testid="shortcut-hint"
          >{{ lockCommandText }}</span
        >
      </button>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

interface Props {
  buttonStyles?: Record<string, string>
}

defineProps<Props>()
const buttonRef = ref<ComponentPublicInstance | null>(null)
const popover = ref<InstanceType<typeof Popover>>()
const menuRef = ref<HTMLElement | null>(null)
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

const toggle = (event: Event) => {
  const el = buttonRef.value?.$el || buttonRef.value
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

async function onPopoverShow() {
  isOpen.value = true
  await nextTick()
  const checkedItem = menuRef.value?.querySelector<HTMLElement>(
    '[aria-checked="true"]'
  )
  checkedItem?.focus()
}

function onPopoverHide() {
  isOpen.value = false
}

function closeAndRestoreFocus() {
  popover.value?.hide()
  const el = buttonRef.value?.$el || buttonRef.value
  ;(el as HTMLElement)?.focus()
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

const popoverPt = computed(() => ({
  root: {
    class: 'absolute z-50 -translate-y-2'
  },
  content: {
    class: [
      'mb-2 text-text-primary',
      'shadow-lg border border-interface-stroke',
      'bg-nav-background',
      'rounded-lg',
      'p-2 px-3',
      'min-w-39',
      'select-none'
    ]
  }
}))
</script>

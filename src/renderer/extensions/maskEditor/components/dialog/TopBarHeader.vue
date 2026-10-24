<template>
  <div class="flex w-full items-center justify-between gap-8 p-2">
    <div class="flex items-center gap-2">
      <h3 class="m-0 mr-8 text-lg font-semibold">
        {{ t('maskEditor.title') }}
      </h3>

      <Button
        variant="secondary"
        size="md"
        class="gap-1.5 px-2.5 text-sm"
        @click="onUndo"
      >
        <i class="icon-[lucide--undo-2] size-4" />
        {{ t('maskEditor.undo') }}
      </Button>

      <Button
        variant="secondary"
        size="md"
        class="gap-1.5 px-2.5 text-sm"
        @click="onRedo"
      >
        <i class="icon-[lucide--redo-2] size-4" />
        {{ t('maskEditor.redo') }}
      </Button>

      <Menu
        v-model:open="imageDropdownOpen"
        :modal="false"
        :items="imageMenuItems"
        align="start"
        :side-offset="5"
        :collision-padding="10"
      >
        <template #trigger>
          <MenuTriggerButton @pointerdown.stop>
            <span class="text-sm font-medium">{{ t('maskEditor.image') }}</span>
          </MenuTriggerButton>
        </template>
      </Menu>

      <Button
        variant="secondary"
        size="md"
        class="gap-1.5 px-2.5 text-sm"
        @click="onInvert"
      >
        <i class="icon-[lucide--flip-vertical-2] size-4" />
        {{ t('maskEditor.invertMask') }}
      </Button>

      <Button
        variant="secondary"
        size="md"
        class="gap-1.5 px-2.5 text-sm"
        @click="onClear"
      >
        <i class="icon-[lucide--trash-2] size-4" />
        {{ t('maskEditor.clear') }}
      </Button>
    </div>

    <div class="flex gap-2">
      <Button
        variant="primary"
        class="gap-1.5 px-3"
        :disabled="!saveEnabled"
        @click="handleSave"
      >
        <i class="icon-[lucide--check] size-4" />
        {{ saveButtonText }}
      </Button>
      <Button variant="secondary" class="gap-1.5 px-3" @click="handleCancel">
        <i class="icon-[lucide--x] size-4" />
        {{ t('g.cancel') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuTriggerButton from '@/renderer/extensions/maskEditor/components/controls/MenuTriggerButton.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import Button from '@/components/ui/button/Button.vue'
import { useCanvasTools } from '@comfyorg/mask-editor/useCanvasTools'
import { useCanvasTransform } from '@comfyorg/mask-editor/useCanvasTransform'
import { useMaskEditorSaver } from '@/renderer/extensions/maskEditor/composables/useMaskEditorSaver'
import { useDialogStore } from '@/stores/dialogStore'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

const { t } = useI18n()
const store = useMaskEditorStore()
const dialogStore = useDialogStore()
const canvasTools = useCanvasTools()
const canvasTransform = useCanvasTransform()
const saver = useMaskEditorSaver()

const saveButtonText = ref(t('g.save'))
const saveEnabled = ref(true)
const imageDropdownOpen = ref(false)

function onUndo() {
  store.canvasHistory.undo()
}

function onRedo() {
  store.canvasHistory.redo()
}

async function onRotateLeft() {
  try {
    await canvasTransform.rotateCounterclockwise()
  } catch (error) {
    console.error('[TopBarHeader] Rotate left failed:', error)
  }
}

async function onRotateRight() {
  try {
    await canvasTransform.rotateClockwise()
  } catch (error) {
    console.error('[TopBarHeader] Rotate right failed:', error)
  }
}

async function onMirrorHorizontal() {
  try {
    await canvasTransform.mirrorHorizontal()
  } catch (error) {
    console.error('[TopBarHeader] Mirror horizontal failed:', error)
  }
}

async function onMirrorVertical() {
  try {
    await canvasTransform.mirrorVertical()
  } catch (error) {
    console.error('[TopBarHeader] Mirror vertical failed:', error)
  }
}

function onInvert() {
  canvasTools.invertMask()
}

function onClear() {
  canvasTools.clearMask()
  store.triggerClear()
}

async function handleSave() {
  saveButtonText.value = t('g.saving')
  saveEnabled.value = false

  try {
    store.brushVisible = false
    await saver.save()
    dialogStore.closeDialog()
  } catch (error) {
    console.error('[TopBarHeader] Save failed:', error)
    store.brushVisible = true
    saveButtonText.value = t('g.save')
    saveEnabled.value = true
  }
}

function handleCancel() {
  dialogStore.closeDialog({ key: 'global-mask-editor' })
}

const imageMenuItems: MenuItem[] = [
  {
    key: 'rotate-left',
    label: t('maskEditor.rotateLeft'),
    icon: 'icon-[lucide--rotate-ccw]',
    command: onRotateLeft
  },
  {
    key: 'rotate-right',
    label: t('maskEditor.rotateRight'),
    icon: 'icon-[lucide--rotate-cw]',
    command: onRotateRight
  },
  {
    key: 'mirror-horizontal',
    label: t('maskEditor.mirrorHorizontal'),
    icon: 'icon-[lucide--flip-horizontal]',
    command: onMirrorHorizontal
  },
  {
    key: 'mirror-vertical',
    label: t('maskEditor.mirrorVertical'),
    icon: 'icon-[lucide--flip-vertical]',
    command: onMirrorVertical
  }
]
</script>

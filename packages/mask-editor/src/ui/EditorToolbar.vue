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
        <i class="icon-[lucide--undo-2]" />
        {{ t('maskEditor.undo') }}
      </Button>

      <Button
        variant="secondary"
        size="md"
        class="gap-1.5 px-2.5 text-sm"
        @click="onRedo"
      >
        <i class="icon-[lucide--redo-2]" />
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
        <i class="icon-[lucide--flip-vertical-2]" />
        {{ t('maskEditor.invertMask') }}
      </Button>

      <Button
        variant="secondary"
        size="md"
        class="gap-1.5 px-2.5 text-sm"
        @click="onClear"
      >
        <i class="icon-[lucide--trash-2]" />
        {{ t('maskEditor.clear') }}
      </Button>
    </div>

    <div class="flex gap-2">
      <Button
        variant="primary"
        class="gap-1.5 px-3"
        :disabled="saving"
        @click="emit('save')"
      >
        <i class="icon-[lucide--check]" />
        {{ t(saving ? 'g.saving' : 'g.save') }}
      </Button>
      <Button variant="secondary" class="gap-1.5 px-3" @click="emit('cancel')">
        <i class="icon-[lucide--x]" />
        {{ t('g.cancel') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import Menu from '@comfyorg/design-system/menu/Menu'

import { useCanvasTools } from '#/useCanvasTools'
import { useCanvasTransform } from '#/useCanvasTransform'
import { useMaskEditorStore } from '#/maskEditorStore'
import MenuTriggerButton from './components/controls/MenuTriggerButton.vue'

const { saving } = defineProps<{ saving: boolean }>()
const emit = defineEmits<{
  save: []
  cancel: []
}>()

const { t } = useI18n()
const store = useMaskEditorStore()
const canvasTools = useCanvasTools()
const canvasTransform = useCanvasTransform()

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
    console.error('[EditorToolbar] Rotate left failed:', error)
  }
}

async function onRotateRight() {
  try {
    await canvasTransform.rotateClockwise()
  } catch (error) {
    console.error('[EditorToolbar] Rotate right failed:', error)
  }
}

async function onMirrorHorizontal() {
  try {
    await canvasTransform.mirrorHorizontal()
  } catch (error) {
    console.error('[EditorToolbar] Mirror horizontal failed:', error)
  }
}

async function onMirrorVertical() {
  try {
    await canvasTransform.mirrorVertical()
  } catch (error) {
    console.error('[EditorToolbar] Mirror vertical failed:', error)
  }
}

function onInvert() {
  canvasTools.invertMask()
}

function onClear() {
  canvasTools.clearMask()
  store.triggerClear()
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

<template>
  <div class="flex w-full items-center justify-between gap-8">
    <div class="flex items-center gap-2">
      <h3 class="m-0 mr-8 text-lg font-semibold">
        {{ t('maskEditor.title') }}
      </h3>

      <button
        type="button"
        class="flex h-8 items-center gap-1.5 rounded-lg border-none bg-secondary-background px-2.5 text-sm transition-colors duration-100 hover:bg-secondary-background-hover"
        @click="onUndo"
      >
        <i class="icon-[lucide--undo-2] size-4" />
        {{ t('maskEditor.undo') }}
      </button>

      <button
        type="button"
        class="flex h-8 items-center gap-1.5 rounded-lg border-none bg-secondary-background px-2.5 text-sm transition-colors duration-100 hover:bg-secondary-background-hover"
        @click="onRedo"
      >
        <i class="icon-[lucide--redo-2] size-4" />
        {{ t('maskEditor.redo') }}
      </button>

      <DropdownMenuRoot
        v-model:open="imageDropdownOpen"
        :modal="false"
        :dismissible="false"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            :aria-label="t('maskEditor.imageTransformations')"
            class="relative flex h-8 items-center justify-center gap-1 rounded-lg border-none bg-secondary-background px-2 text-center transition-colors duration-100 hover:bg-secondary-background-hover"
            @pointerdown.stop
          >
            <span class="text-sm font-medium">{{ t('maskEditor.image') }}</span>
            <i
              class="icon-[lucide--chevron-down] size-3 text-muted-foreground"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal to="body">
          <DropdownMenuContent
            align="start"
            :side-offset="5"
            :collision-padding="10"
            class="z-2102 min-w-56 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
          >
            <WorkflowActionsList :items="imageMenuItems" />
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <button
        type="button"
        class="flex h-8 items-center gap-1.5 rounded-lg border-none bg-secondary-background px-2.5 text-sm transition-colors duration-100 hover:bg-secondary-background-hover"
        @click="onInvert"
      >
        <i class="icon-[lucide--flip-vertical-2] size-4" />
        {{ t('maskEditor.invertMask') }}
      </button>

      <button
        type="button"
        class="flex h-8 items-center gap-1.5 rounded-lg border-none bg-secondary-background px-2.5 text-sm transition-colors duration-100 hover:bg-secondary-background-hover"
        @click="onClear"
      >
        <i class="icon-[lucide--trash-2] size-4" />
        {{ t('maskEditor.clear') }}
      </button>
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        class="text-primary-background-fg flex h-8 items-center gap-1.5 rounded-lg border-none bg-primary-background px-3 text-sm font-medium transition-colors duration-100 hover:bg-primary-background-hover disabled:opacity-50"
        :disabled="!saveEnabled"
        @click="handleSave"
      >
        <i class="icon-[lucide--check] size-4" />
        {{ saveButtonText }}
      </button>
      <button
        type="button"
        class="flex h-8 items-center gap-1.5 rounded-lg border-none bg-secondary-background px-3 text-sm transition-colors duration-100 hover:bg-secondary-background-hover"
        @click="handleCancel"
      >
        <i class="icon-[lucide--x] size-4" />
        {{ t('g.cancel') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import WorkflowActionsList from '@/components/common/WorkflowActionsList.vue'
import { useCanvasTools } from '@/composables/maskeditor/useCanvasTools'
import { useCanvasTransform } from '@/composables/maskeditor/useCanvasTransform'
import { useMaskEditorSaver } from '@/composables/maskeditor/useMaskEditorSaver'
import { useDialogStore } from '@/stores/dialogStore'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

const { t } = useI18n()
const store = useMaskEditorStore()
const dialogStore = useDialogStore()
const canvasTools = useCanvasTools()
const canvasTransform = useCanvasTransform()
const saver = useMaskEditorSaver()

const saveButtonText = ref(t('g.save'))
const saveEnabled = ref(true)
const imageDropdownOpen = ref(false)

const onUndo = () => {
  store.canvasHistory.undo()
}

const onRedo = () => {
  store.canvasHistory.redo()
}

const onRotateLeft = async () => {
  try {
    await canvasTransform.rotateCounterclockwise()
  } catch (error) {
    console.error('[TopBarHeader] Rotate left failed:', error)
  }
}

const onRotateRight = async () => {
  try {
    await canvasTransform.rotateClockwise()
  } catch (error) {
    console.error('[TopBarHeader] Rotate right failed:', error)
  }
}

const onMirrorHorizontal = async () => {
  try {
    await canvasTransform.mirrorHorizontal()
  } catch (error) {
    console.error('[TopBarHeader] Mirror horizontal failed:', error)
  }
}

const onMirrorVertical = async () => {
  try {
    await canvasTransform.mirrorVertical()
  } catch (error) {
    console.error('[TopBarHeader] Mirror vertical failed:', error)
  }
}

const onInvert = () => {
  canvasTools.invertMask()
}

const onClear = () => {
  canvasTools.clearMask()
  store.triggerClear()
}

const handleSave = async () => {
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

const handleCancel = () => {
  dialogStore.closeDialog({ key: 'global-mask-editor' })
}

const imageMenuItems = [
  {
    id: 'rotate-left',
    label: t('maskEditor.rotateLeft'),
    icon: 'icon-[lucide--rotate-ccw]',
    command: onRotateLeft
  },
  {
    id: 'rotate-right',
    label: t('maskEditor.rotateRight'),
    icon: 'icon-[lucide--rotate-cw]',
    command: onRotateRight
  },
  {
    id: 'mirror-horizontal',
    label: t('maskEditor.mirrorHorizontal'),
    icon: 'icon-[lucide--flip-horizontal]',
    command: onMirrorHorizontal
  },
  {
    id: 'mirror-vertical',
    label: t('maskEditor.mirrorVertical'),
    icon: 'icon-[lucide--flip-vertical]',
    command: onMirrorVertical
  }
]
</script>

<style scoped>
:deep(.workflow-actions-list-item span) {
  font-size: 0.875rem;
  line-height: 1.25rem;
}
</style>

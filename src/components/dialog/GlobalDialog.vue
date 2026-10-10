<!-- The main global dialog to show various things -->
<template>
  <template v-for="item in dialogStore.dialogStack" :key="item.key">
    <Dialog
      :open="item.visible"
      @update:open="(open) => onRekaOpenChange(item.key, open)"
    >
      <DialogPortal>
        <DialogOverlay v-reka-z-index />
        <DialogContent
          v-reka-z-index
          v-bind="
            item.dialogComponentProps.useAutomaticLabeling
              ? {}
              : { 'aria-labelledby': item.key }
          "
          :size="
            item.dialogComponentProps.headless
              ? 'fit'
              : (item.dialogComponentProps.size ?? 'md')
          "
          :surface="item.dialogComponentProps.headless ? 'none' : 'card'"
          :maximized="!!item.dialogComponentProps.maximized"
          :data-dialog-key="item.key"
          @escape-key-down="
            (e) =>
              (dialogStore.activeKey !== item.key ||
                item.dialogComponentProps.closable === false) &&
              e.preventDefault()
          "
          @pointer-down-outside="
            (e) =>
              onRekaPointerDownOutside(
                item.dialogComponentProps,
                e,
                dialogStore.activeKey === item.key
              )
          "
          @mousedown="() => dialogStore.riseDialog({ key: item.key })"
        >
          <template v-if="item.dialogComponentProps.headless">
            <component
              :is="item.component"
              v-bind="item.contentProps"
              :maximized="item.dialogComponentProps.maximized"
            />
          </template>
          <template v-else>
            <DialogHeader
              :class="
                item.headerComponent &&
                item.dialogComponentProps.flush &&
                cn('p-0', hasHeaderActions(item) && 'pr-3')
              "
            >
              <component
                :is="item.headerComponent"
                v-if="item.headerComponent"
                v-bind="item.headerProps"
                :id="item.key"
              />
              <DialogTitle v-else :id="item.key">
                {{ item.title || ' ' }}
              </DialogTitle>
              <div
                v-if="hasHeaderActions(item)"
                class="flex items-center gap-1"
              >
                <DialogMaximize
                  v-if="item.dialogComponentProps.maximizable"
                  :maximized="!!item.dialogComponentProps.maximized"
                  @toggle="toggleMaximize(item)"
                />
                <DialogClose v-if="hasCloseButton(item)" />
              </div>
            </DialogHeader>
            <div
              :class="
                cn(
                  'flex min-h-0 flex-1 flex-col overflow-auto',
                  !item.dialogComponentProps.flush && 'px-4 py-2'
                )
              "
            >
              <component
                :is="item.component"
                v-bind="item.contentProps"
                :maximized="item.dialogComponentProps.maximized"
              />
            </div>
            <DialogFooter
              v-if="item.footerComponent"
              :class="item.dialogComponentProps.flush && 'p-0'"
            >
              <component :is="item.footerComponent" v-bind="item.footerProps" />
            </DialogFooter>
          </template>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  </template>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogMaximize from '@/components/ui/dialog/DialogMaximize.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { onRekaPointerDownOutside } from '@/components/dialog/dialogDismissGuards'
import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import type { DialogInstance } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

function onRekaOpenChange(key: string, open: boolean) {
  if (!open) dialogStore.closeDialog({ key })
}

function hasCloseButton({ dialogComponentProps }: DialogInstance) {
  return (
    dialogComponentProps.closable !== false &&
    dialogComponentProps.showCloseButton !== false
  )
}

function hasHeaderActions(item: DialogInstance) {
  return !!item.dialogComponentProps.maximizable || hasCloseButton(item)
}

function toggleMaximize(item: DialogInstance) {
  item.dialogComponentProps.maximized = !item.dialogComponentProps.maximized
}
</script>

<!-- The main global dialog to show various things -->
<template>
  <template v-for="item in dialogStore.dialogStack" :key="item.key">
    <Dialog
      v-if="isRekaItem(item)"
      :open="item.visible"
      :modal="item.dialogComponentProps.modal ?? true"
      @update:open="(open) => onRekaOpenChange(item.key, open)"
    >
      <DialogPortal>
        <DialogOverlay :class="item.dialogComponentProps.overlayClass" />
        <DialogContent
          :size="item.dialogComponentProps.size ?? 'md'"
          :maximized="!!item.dialogComponentProps.maximized"
          :class="item.dialogComponentProps.contentClass"
          :aria-labelledby="item.key"
          @escape-key-down="
            (e) =>
              item.dialogComponentProps.closeOnEscape === false &&
              e.preventDefault()
          "
          @pointer-down-outside="
            (e) => onRekaPointerDownOutside(item.dialogComponentProps, e)
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
            <DialogHeader>
              <component
                :is="item.headerComponent"
                v-if="item.headerComponent"
                v-bind="item.headerProps"
                :id="item.key"
              />
              <DialogTitle v-else :id="item.key">
                {{ item.title || ' ' }}
              </DialogTitle>
              <div class="flex items-center gap-1">
                <DialogMaximize
                  v-if="item.dialogComponentProps.maximizable"
                  :maximized="!!item.dialogComponentProps.maximized"
                  @toggle="toggleMaximize(item)"
                />
                <DialogClose
                  v-if="item.dialogComponentProps.closable !== false"
                />
              </div>
            </DialogHeader>
            <div class="flex-1 overflow-auto px-4 py-2">
              <component
                :is="item.component"
                v-bind="item.contentProps"
                :maximized="item.dialogComponentProps.maximized"
              />
            </div>
            <DialogFooter v-if="item.footerComponent">
              <component :is="item.footerComponent" v-bind="item.footerProps" />
            </DialogFooter>
          </template>
        </DialogContent>
      </DialogPortal>
    </Dialog>
    <PrimeDialog
      v-else
      v-model:visible="item.visible"
      class="global-dialog"
      v-bind="item.dialogComponentProps"
      :aria-labelledby="item.key"
    >
      <template #header>
        <div v-if="!item.dialogComponentProps?.headless">
          <component
            :is="item.headerComponent"
            v-if="item.headerComponent"
            v-bind="item.headerProps"
            :id="item.key"
          />
          <h3 v-else :id="item.key">
            {{ item.title || ' ' }}
          </h3>
        </div>
      </template>

      <component
        :is="item.component"
        v-bind="item.contentProps"
        :maximized="item.dialogComponentProps.maximized"
      />

      <template v-if="item.footerComponent" #footer>
        <component :is="item.footerComponent" v-bind="item.footerProps" />
      </template>
    </PrimeDialog>
  </template>
</template>

<script setup lang="ts">
import PrimeDialog from 'primevue/dialog'

import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogMaximize from '@/components/ui/dialog/DialogMaximize.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { onRekaPointerDownOutside } from '@/components/dialog/rekaPrimeVueBridge'
import type { DialogInstance } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

function isRekaItem(item: DialogInstance) {
  return item.dialogComponentProps.renderer === 'reka'
}

function onRekaOpenChange(key: string, open: boolean) {
  if (!open) dialogStore.closeDialog({ key })
}

function toggleMaximize(item: DialogInstance) {
  item.dialogComponentProps.maximized = !item.dialogComponentProps.maximized
}
</script>

<style>
.global-dialog {
  max-width: calc(100vw - 1rem);
}

.global-dialog .p-dialog-header {
  padding: calc(var(--spacing) * 2);
  padding-bottom: 0;
}

.global-dialog .p-dialog-content {
  padding: calc(var(--spacing) * 2);
  padding-top: 0;
}

@media (min-width: 1536px) {
  .global-dialog .p-dialog-header {
    padding: var(--p-dialog-header-padding);
    padding-bottom: 0;
  }

  .global-dialog .p-dialog-content {
    padding: var(--p-dialog-content-padding);
    padding-top: 0;
  }
}

.manager-dialog {
  height: 80vh;
  max-width: 1724px;
  max-height: 1026px;
}

@media (min-width: 3000px) {
  .manager-dialog {
    max-width: 2200px;
    max-height: 1320px;
  }
}
</style>

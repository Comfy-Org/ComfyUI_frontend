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
        <DialogOverlay
          v-reka-z-index
          :class="item.dialogComponentProps.overlayClass"
        />
        <DialogContent
          v-reka-z-index
          :size="item.dialogComponentProps.size ?? 'md'"
          :maximized="!!item.dialogComponentProps.maximized"
          :class="item.dialogComponentProps.contentClass"
          :aria-labelledby="item.key"
          :aria-describedby="
            item.dialogComponentProps.describedBy
              ? `${item.key}-description`
              : undefined
          "
          @open-auto-focus="(e) => onRekaOpenAutoFocus(e, item.key)"
          @escape-key-down="
            (e) =>
              item.dialogComponentProps.closeOnEscape === false &&
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
          @focus-outside="
            (e) => onRekaFocusOutside(e, item.dialogComponentProps)
          "
          @mousedown="() => dialogStore.riseDialog({ key: item.key })"
        >
          <template v-if="item.dialogComponentProps.headless">
            <!--
              DialogContent's aria-labelledby/aria-describedby point at
              item.key derived ids, so self-rendered content must put those
              ids on its heading and message for the dialog to keep its
              accessible name and description.
            -->
            <component
              :is="item.component"
              v-bind="item.contentProps"
              :maximized="item.dialogComponentProps.maximized"
              :title-id="item.key"
              :description-id="
                item.dialogComponentProps.describedBy
                  ? `${item.key}-description`
                  : undefined
              "
            />
          </template>
          <template v-else>
            <DialogHeader :class="item.dialogComponentProps.headerClass">
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
            <div
              :class="
                cn(
                  'flex-1 overflow-auto px-4 py-2',
                  item.dialogComponentProps.bodyClass
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
              :class="item.dialogComponentProps.footerClass"
            >
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
import {
  onRekaFocusOutside,
  onRekaPointerDownOutside
} from '@/components/dialog/rekaPrimeVueBridge'
import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import type { DialogInstance } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

function isRekaItem(item: DialogInstance) {
  return item.dialogComponentProps.renderer === 'reka'
}

function onRekaOpenChange(key: string, open: boolean) {
  if (!open) dialogStore.closeDialog({ key })
}

// Reka's FocusScope focuses the first tabbable element on open (often a header
// or footer button). Dialog content that marks an input with `autofocus` (e.g.
// the keybinding capture input, the prompt input) relied on PrimeVue honoring
// that attribute, so honor it here: focus the autofocus target and cancel
// Reka's default auto-focus when one is present.
function onRekaOpenAutoFocus(event: Event, key: string) {
  const content = document.querySelector<HTMLElement>(
    `[aria-labelledby="${CSS.escape(key)}"]`
  )
  const autofocusEl = content?.querySelector<HTMLElement>('[autofocus]')
  if (autofocusEl) {
    event.preventDefault()
    autofocusEl.focus()
  }
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

<template>
  <div class="flex max-h-[85vh] flex-col">
    <div
      class="flex h-12 shrink-0 items-center justify-between border-b border-border-default px-4"
    >
      <h2 :id="titleId" class="m-0 text-sm font-normal text-base-foreground">
        {{ title }}
      </h2>
      <button
        class="focus-visible:ring-secondary-foreground -mr-1 flex size-8 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="dialogStore.closeDialog()"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <div class="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <slot />
    </div>

    <div class="flex shrink-0 items-center justify-end gap-4 p-4">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDialogStore } from '@/stores/dialogStore'

/**
 * The design-system "Small Dialog Modal" shell: header (title + close),
 * scrollable body (default slot) and footer (named slot). Content components
 * opened with `headless: true` wrap themselves in this shell; the outer box
 * styling comes from `CONFIRMATION_DIALOG_CONTENT_CLASS`. The close button
 * closes the active dialog, which triggers the dialog's `onClose` callback.
 *
 * `titleId` is injected by `GlobalDialog` (as `title-id` on the headless
 * content, reaching this root via attrs fallthrough) and must end up on the
 * heading: the dialog's `aria-labelledby` references it, giving the dialog
 * its accessible name.
 */
defineProps<{
  title: string
  titleId?: string
}>()

const dialogStore = useDialogStore()
</script>

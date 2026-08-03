# Dialog

**Path:** `src/components/ui/dialog/{Dialog,DialogPortal,DialogOverlay,DialogContent,DialogHeader,DialogFooter,DialogTitle,DialogDescription,DialogClose,DialogMaximize}.vue`, `dialog.variants.ts`
**Built on:** Reka UI `DialogRoot` family

## Purpose

Modal (or non-modal) dialog for confirmations, forms, and maximizable panels. A composable set of sub-parts, not one monolithic component.

## Pieces

| Component           | Role                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `Dialog`            | root; `v-model:open`; props `open?`, `defaultOpen?`, `modal?`                              |
| `DialogPortal`      | teleports content to `<body>` (or `:to`)                                                   |
| `DialogOverlay`     | backdrop scrim; renders even for non-modal dialogs (plain div fallback)                    |
| `DialogContent`     | the panel itself; props `size`, `maximized`, `class`                                       |
| `DialogHeader`      | flex row layout wrapper (title + close button)                                             |
| `DialogFooter`      | flex row layout wrapper, right-aligned (action buttons)                                    |
| `DialogTitle`       | `text-base font-semibold`                                                                  |
| `DialogDescription` | `text-sm text-muted-foreground`                                                            |
| `DialogClose`       | icon-only `Button` (`variant="muted-textonly"`, `icon-[lucide--x]`) that closes the dialog |
| `DialogMaximize`    | standalone toggle button; props `maximized?`; emits `toggle`                               |

## Variants (`dialogContentVariants`, cva)

`size`: `sm | md | lg | xl | full` (default `md`) — maps to `sm:max-w-sm/xl/3xl/5xl/[calc(100vw-1rem)]`.
`maximized`: `true | false` (default `false`) — when true, forces `inset-2 size-auto max-h-none max-w-none`.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'

const open = ref(false)
</script>

<template>
  <Button @click="open = true">Open dialog</Button>
  <Dialog v-model:open="open">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <div class="px-4 py-2">
          <DialogDescription>
            This action cannot be undone. The selected items will be permanently
            removed.
          </DialogDescription>
        </div>
        <DialogFooter>
          <Button variant="textonly" @click="open = false">Cancel</Button>
          <Button variant="destructive" @click="open = false">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
```

## Do

- Always render `DialogHeader` + `DialogTitle` for accessibility, even in a "headless" custom-body dialog.
- Put Cancel/secondary action on the left of the footer, the primary or destructive action on the right — see `patterns/confirmation-dialogs.md`.
- Use `size="sm"` for confirmations, `md` for typical forms, `lg`/`xl` for content-heavy panels, `full` for near-fullscreen.
- Wrap a scrollable dialog body in its own `overflow-auto` div so header/footer stay pinned.

## Don't

- Don't hardcode `z-[...]` on dialog content — the variant already sets `z-1700`, matching every other overlay in the system.
- Don't skip `DialogOverlay` for a "non-modal" dialog assuming there's no backdrop — it renders a plain scrim div even then.

## Notes

Full sizing: `sm` / `md` / `lg` / `xl` / `full`. `DialogContent` accepts additional Reka pass-through props (`forceMount`, `trapFocus`) and events (`escapeKeyDown`, `pointerDownOutside`, `focusOutside`, `interactOutside`, `openAutoFocus`, `closeAutoFocus`).

<template>
  <Dialog v-model:open="open">
    <DialogPortal>
      <DialogOverlay v-reka-z-index class="bg-black/60" />
      <DialogContent
        v-reka-z-index
        data-testid="coach-landing"
        class="w-[800px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border-border-default bg-secondary-background p-0 shadow-[0_24px_80px_rgba(0,0,0,0.85)] md:min-h-98 md:max-w-[800px] md:flex-row"
        @pointer-down-outside.prevent
        @open-auto-focus="onOpenAutoFocus"
      >
        <DialogClose as-child>
          <Button
            variant="muted-textonly"
            size="icon"
            :aria-label="t('g.close')"
            class="absolute top-3 right-3 z-20"
          >
            <i class="icon-[lucide--x]" />
          </Button>
        </DialogClose>
        <div
          class="flex aspect-video items-center justify-center bg-base-background md:aspect-auto md:w-1/2"
        >
          <img
            v-if="image"
            :src="image"
            alt=""
            class="size-full object-cover"
          />
        </div>
        <div
          class="flex flex-col items-start justify-between self-stretch px-15 pt-15 pb-10 md:w-1/2"
        >
          <div class="flex flex-col gap-3">
            <DialogTitle
              class="m-0 text-[28px] leading-normal font-medium text-base-foreground"
            >
              {{ title }}
            </DialogTitle>
            <DialogDescription
              class="flex flex-col items-start gap-2 self-stretch py-2 text-base/5 text-muted-foreground"
            >
              {{ message }}
            </DialogDescription>
          </div>
          <div class="flex w-full items-center justify-end gap-2">
            <Button variant="secondary" size="lg" @click="open = false">
              {{ skipLabel }}
            </Button>
            <Button
              ref="startButtonRef"
              variant="inverted"
              size="lg"
              @click="emit('start')"
            >
              {{ primaryLabel }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Button from '@/components/ui/button/Button.vue'
import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'

const { title, message, image, primaryLabel, skipLabel } = defineProps<{
  title: string
  message: string
  image?: string
  primaryLabel: string
  skipLabel: string
}>()

const open = defineModel<boolean>('open', { required: true })

// The global keybinding handler (window keydown) matches Escape and calls
// preventDefault before Reka's DismissableLayer sees it, so Reka skips its own
// dismiss (it only dismisses when !event.defaultPrevented). Close explicitly —
// the same path Skip and Reka's dismissal would take.
useEventListener(document, 'keydown', (e) => {
  if (e.key === 'Escape' && open.value) open.value = false
})

const emit = defineEmits<{
  start: []
}>()

const startButtonRef = useTemplateRef('startButtonRef')

// Land focus on the primary action instead of the close button reka would
// otherwise focus first.
function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  const el = startButtonRef.value?.$el as HTMLButtonElement | undefined
  el?.focus()
}

const { t } = useI18n()
</script>

<template>
  <Dialog :open="true" @update:open="(value) => !value && emit('skip')">
    <DialogPortal>
      <DialogOverlay data-testid="coach-landing-overlay" class="bg-black/60" />
      <DialogContent
        data-testid="coach-landing"
        class="w-[800px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl bg-secondary p-0 shadow-2xl md:h-fit md:min-h-100 md:max-w-[800px] md:flex-row"
        @pointer-down-outside.prevent
        @open-auto-focus="onOpenAutoFocus"
      >
        <DialogClose :aria-label="$t('g.close')" as-child>
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
          class="flex aspect-video items-center justify-center bg-background md:aspect-auto md:w-1/2"
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
          <div class="flex flex-col gap-2.5">
            <DialogTitle class="m-0 text-[28px] leading-normal font-medium">
              {{ title }}
            </DialogTitle>
            <DialogDescription
              class="flex flex-col items-start gap-2 self-stretch text-base/5"
            >
              {{ message }}
            </DialogDescription>
          </div>
          <div class="flex w-full items-center justify-end gap-2">
            <Button variant="secondary" size="lg" @click="emit('skip')">
              {{ skipLabel }}
            </Button>
            <Button
              ref="startButtonRef"
              variant="inverted"
              size="lg"
              class="grow"
              :disabled="waitingForTarget"
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

const { title, message, image, primaryLabel, skipLabel, waitingForTarget } =
  defineProps<{
    title: string
    message: string
    image?: string
    primaryLabel: string
    skipLabel: string
    waitingForTarget: boolean
  }>()

const emit = defineEmits<{
  start: []
  skip: []
}>()

const { t } = useI18n()

// The global keybinding handler preventDefaults Escape before Reka's
// DismissableLayer sees it, so Reka skips its own dismiss; do it explicitly.
useEventListener(document, 'keydown', (e) => {
  if (e.key === 'Escape') emit('skip')
})

const startButtonRef = useTemplateRef('startButtonRef')

// Land focus on the primary action, not the close button Reka would pick.
function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  const el = startButtonRef.value?.$el as HTMLButtonElement | undefined
  el?.focus()
}
</script>

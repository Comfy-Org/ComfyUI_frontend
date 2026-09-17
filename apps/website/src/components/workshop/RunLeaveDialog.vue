<script setup lang="ts">
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

// The same run, and the same two choices, whichever way out of it the reader
// took: off the page, or off the workspace that is paying for it.
const COPY = {
  leave: {
    body: 'workshop.run.leaveBody',
    stay: 'workshop.run.leaveStay',
    confirm: 'workshop.run.leaveAnyway'
  },
  switchWorkspace: {
    body: 'workshop.run.switchBody',
    stay: 'workshop.run.switchStay',
    confirm: 'workshop.run.switchAnyway'
  }
} as const satisfies Record<string, Record<string, TranslationKey>>

const { action = 'leave', locale = 'en' } = defineProps<{
  action?: keyof typeof COPY
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ leave: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t(COPY[action].stay, locale)"
      class="flex flex-col gap-6 sm:max-w-xl"
      data-testid="run-leave-dialog"
    >
      <div class="flex flex-col gap-2">
        <DialogTitle class="pr-16">
          {{ t('workshop.run.leaveTitle', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t(COPY[action].body, locale) }}
        </DialogDescription>
      </div>

      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"
      >
        <Button
          variant="outline"
          size="lg"
          class="px-5"
          data-testid="run-leave-stay"
          @click="open = false"
        >
          {{ t(COPY[action].stay, locale) }}
        </Button>
        <Button
          size="lg"
          class="px-5"
          data-testid="run-leave-confirm"
          @click="emit('leave')"
        >
          {{ t(COPY[action].confirm, locale) }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

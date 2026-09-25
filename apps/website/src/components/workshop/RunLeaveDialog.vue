<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'
import { computed } from 'vue'

import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

// The same run, and the same two choices, whichever way out of it the reader
// took: off the page, or off the workspace that is paying for it. A run the
// cloud is keeping asks the same question and answers it the other way round,
// so it reads as news rather than as a warning.
const COPY = {
  leave: {
    title: 'workshop.run.leaveTitle',
    body: 'workshop.run.leaveBody',
    stay: 'workshop.run.leaveStay',
    confirm: 'workshop.run.leaveAnyway'
  },
  switchWorkspace: {
    title: 'workshop.run.leaveTitle',
    body: 'workshop.run.switchBody',
    stay: 'workshop.run.switchStay',
    confirm: 'workshop.run.switchAnyway'
  },
  leaveSaved: {
    title: 'workshop.run.savedTitle',
    body: 'workshop.run.savedBody',
    stay: 'workshop.run.savedStay',
    confirm: 'workshop.run.savedLeave'
  }
} as const satisfies Record<string, Record<string, TranslationKey>>

const {
  action = 'leave',
  assetsHref,
  locale = 'en'
} = defineProps<{
  action?: keyof typeof COPY
  /** Where the kept result will be, offered beside the way out. */
  assetsHref?: string
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ leave: []; cancel: [] }>()

// Leaving a kept run costs nothing, so the only choice worth a button is the
// one that costs something: stopping the machine the reader is paying for.
const stopping = computed(() => action === 'leaveSaved')
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
          {{ t(COPY[action].title, locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t(COPY[action].body, locale) }}
        </DialogDescription>
        <a
          v-if="assetsHref"
          :href="assetsHref"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg text-sm font-medium text-primary-comfy-yellow underline-offset-4 transition-colors outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          data-testid="run-leave-assets"
        >
          {{ t('workshop.run.savedAssets', locale) }}
          <ExternalLink class="size-3.5" aria-hidden="true" />
        </a>
      </div>

      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"
      >
        <Button
          variant="outline"
          size="lg"
          class="px-5"
          :data-testid="stopping ? 'run-leave-cancel' : 'run-leave-stay'"
          @click="stopping ? emit('cancel') : (open = false)"
        >
          {{
            stopping
              ? t('workshop.run.savedCancel', locale)
              : t(COPY[action].stay, locale)
          }}
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

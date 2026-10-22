<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

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
const { t } = translationsFor(locale)
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ leave: []; keep: [] }>()

// A reader who walks away is not waiting for this result, so leaving stops the
// machine, as it always has. Only where the cloud would keep the result is
// carrying on worth offering at all, and then only as the quieter choice.
const offersToKeep = computed(() => action === 'leaveSaved')
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t(COPY[action].stay)"
      class="flex flex-col gap-6 sm:max-w-xl"
      data-testid="run-leave-dialog"
    >
      <div class="flex flex-col gap-2">
        <DialogTitle class="pr-16">
          {{ t(COPY[action].title) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t(COPY[action].body) }}
        </DialogDescription>
        <a
          v-if="assetsHref"
          :href="assetsHref"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg text-sm font-medium text-primary-comfy-yellow underline-offset-4 transition-colors outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          data-testid="run-leave-assets"
        >
          {{ t('workshop.run.savedAssets') }}
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
          :data-testid="offersToKeep ? 'run-leave-keep' : 'run-leave-stay'"
          @click="offersToKeep ? emit('keep') : (open = false)"
        >
          {{
            offersToKeep ? t('workshop.run.savedKeep') : t(COPY[action].stay)
          }}
        </Button>
        <Button
          size="lg"
          class="px-5"
          data-testid="run-leave-confirm"
          @click="emit('leave')"
        >
          {{ t(COPY[action].confirm) }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

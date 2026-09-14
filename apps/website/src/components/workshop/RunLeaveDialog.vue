<script setup lang="ts">
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ leave: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t('workshop.run.leaveStay', locale)"
      class="flex flex-col gap-6 sm:max-w-md"
      data-testid="run-leave-dialog"
    >
      <div class="flex flex-col gap-2">
        <DialogTitle class="pr-16">
          {{ t('workshop.run.leaveTitle', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.run.leaveBody', locale) }}
        </DialogDescription>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          size="lg"
          class="px-5"
          data-testid="run-leave-stay"
          @click="open = false"
        >
          {{ t('workshop.run.leaveStay', locale) }}
        </Button>
        <Button
          size="lg"
          class="px-5"
          data-testid="run-leave-confirm"
          @click="emit('leave')"
        >
          {{ t('workshop.run.leaveAnyway', locale) }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

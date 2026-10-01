<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ replace: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t('workshop.examples.replaceKeep')"
      hide-close
      class="flex flex-col gap-6 sm:max-w-md"
      data-testid="example-replace-dialog"
    >
      <div class="flex flex-col gap-3">
        <DialogTitle>
          {{ t('workshop.examples.replaceTitle') }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.examples.replaceBody') }}
        </DialogDescription>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          size="lg"
          class="px-5"
          data-testid="example-replace-keep"
          @click="open = false"
        >
          {{ t('workshop.examples.replaceKeep') }}
        </Button>
        <Button
          size="lg"
          class="px-5"
          data-testid="example-replace-confirm"
          @click="emit('replace')"
        >
          {{ t('workshop.examples.replaceConfirm') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ replace: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t('workshop.examples.replaceKeep', locale)"
      class="flex flex-col gap-8 sm:max-w-md"
      data-testid="example-replace-dialog"
    >
      <div class="flex flex-col gap-3">
        <DialogTitle class="pr-16">
          {{ t('workshop.examples.replaceTitle', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.examples.replaceBody', locale) }}
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
          {{ t('workshop.examples.replaceKeep', locale) }}
        </Button>
        <Button
          size="lg"
          class="px-5"
          data-testid="example-replace-confirm"
          @click="emit('replace')"
        >
          {{ t('workshop.examples.replaceConfirm', locale) }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

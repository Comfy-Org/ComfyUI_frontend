<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { useMockSession } from '../../composables/useMockSession'
import { useSignInDialog } from '../../composables/useSignInDialog'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { isOpen, close } = useSignInDialog()
const { signIn } = useMockSession()
const email = ref('')

const providers = [
  { id: 'google', label: 'workshop.signIn.google' },
  { id: 'github', label: 'workshop.signIn.github' }
] as const

function complete() {
  signIn()
  close()
}

function onOpenChange(open: boolean) {
  if (!open) close()
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="onOpenChange">
    <DialogContent
      :close-label="t('nav.close', locale)"
      class="sm:max-w-md"
      data-testid="sign-in-dialog"
    >
      <DialogTitle class="pr-12 text-2xl">
        {{ t('workshop.signIn.title', locale) }}
      </DialogTitle>
      <DialogDescription class="mt-2 text-sm text-primary-warm-gray">
        {{ t('workshop.signIn.description', locale) }}
      </DialogDescription>

      <div class="mt-8 flex flex-col gap-3">
        <Button
          v-for="provider in providers"
          :key="provider.id"
          variant="outline"
          size="lg"
          class="w-full"
          :data-testid="`sign-in-${provider.id}`"
          @click="complete"
        >
          {{ t(provider.label, locale) }}
        </Button>
      </div>

      <div class="my-6 flex items-center gap-3 text-xs text-primary-warm-gray">
        <span class="h-px flex-1 bg-transparency-white-t8" />
        {{ t('workshop.signIn.or', locale) }}
        <span class="h-px flex-1 bg-transparency-white-t8" />
      </div>

      <form class="flex flex-col gap-3" @submit.prevent="complete">
        <label class="flex flex-col gap-1.5 text-sm">
          <span class="text-primary-warm-gray">
            {{ t('workshop.signIn.email', locale) }}
          </span>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            data-testid="sign-in-email"
            class="bg-transparency-white-t4 focus-visible:border-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 h-11 rounded-2xl border border-transparency-white-t20 px-4 text-primary-warm-white outline-none focus-visible:ring-3"
          />
        </label>
        <Button type="submit" size="lg" class="w-full">
          {{ t('workshop.signIn.continue', locale) }}
        </Button>
      </form>

      <p class="mt-6 text-xs text-primary-warm-gray">
        {{ t('workshop.signIn.footnote', locale) }}
      </p>
    </DialogContent>
  </Dialog>
</template>

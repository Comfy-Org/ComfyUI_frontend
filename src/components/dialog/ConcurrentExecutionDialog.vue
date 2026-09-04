<template>
  <Dialog v-model:open="visible">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {{ $t('concurrentExecution.onboarding.title') }}
          </DialogTitle>
          <DialogClose />
        </DialogHeader>
        <p class="px-4 py-2 text-sm text-text-secondary">
          {{ $t('concurrentExecution.onboarding.description') }}
        </p>
        <DialogFooter>
          <Button autofocus @click="dismiss">
            {{ $t('concurrentExecution.onboarding.gotIt') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { useConcurrentExecution } from '@/composables/useConcurrentExecution'

const { isConcurrentExecutionEnabled, hasSeenOnboarding, markOnboardingSeen } =
  useConcurrentExecution()

const dismissed = ref(false)

const visible = computed({
  get: () =>
    isConcurrentExecutionEnabled.value &&
    !hasSeenOnboarding.value &&
    !dismissed.value,
  set: () => {
    dismissed.value = true
  }
})

async function dismiss() {
  await markOnboardingSeen()
  dismissed.value = true
}
</script>

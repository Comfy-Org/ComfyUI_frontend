<template>
  <DialogPanel
    class="w-90 max-w-full"
    data-testid="member-resubscribe-message"
    @close="onClose"
  >
    <template #title>
      {{ $t('subscription.inactive.memberTitle') }}
    </template>

    <div class="p-4">
      <p class="m-0 font-inter text-sm text-muted-foreground">
        {{ $t('subscription.inactive.memberDescription') }}
      </p>
    </div>

    <template #footer>
      <Button variant="secondary" size="lg" @click="onClose">
        {{ $t('subscription.inactive.memberCta') }}
      </Button>
    </template>
  </DialogPanel>
</template>

<script setup lang="ts">
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'
import Button from '@/components/ui/button/Button.vue'

const { onClose } = defineProps<{
  onClose: () => void
}>()
</script>

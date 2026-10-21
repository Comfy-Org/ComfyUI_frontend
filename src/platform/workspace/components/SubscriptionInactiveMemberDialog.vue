<template>
  <AppDialogPanel
    size="compact"
    data-testid="member-resubscribe-message"
    @close="onClose"
  >
    <template #title>
      {{ $t('subscription.inactive.memberTitle') }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('subscription.inactive.memberDescription') }}
    </p>

    <template #footer>
      <Button variant="secondary" size="lg" @click="onClose">
        {{ $t('subscription.inactive.memberCta') }}
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import Button from '@/components/ui/button/Button.vue'

const { onClose } = defineProps<{
  onClose: () => void
}>()
</script>

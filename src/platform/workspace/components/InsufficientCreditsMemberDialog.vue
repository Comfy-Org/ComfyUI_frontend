<template>
  <AppDialogPanel
    size="compact"
    data-testid="insufficient-credits-member-message"
    @close="onClose"
  >
    <template #title>
      {{ $t('credits.insufficient.memberTitle') }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('credits.insufficient.memberDescription') }}
    </p>

    <template #footer>
      <Button variant="secondary" size="lg" @click="onClose">
        {{ $t('credits.insufficient.memberCta') }}
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

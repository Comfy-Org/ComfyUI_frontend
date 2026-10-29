<template>
  <AppDialogPanel
    size="compact"
    class="w-90 max-w-full"
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
import Button from '@comfyorg/design-system/button/Button'

import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'

const { onClose } = defineProps<{
  onClose: () => void
}>()
</script>

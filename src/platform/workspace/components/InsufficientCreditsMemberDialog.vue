<template>
  <DialogPanel
    class="w-90 max-w-full"
    data-testid="insufficient-credits-member-message"
    @close="onClose"
  >
    <template #title>
      {{ $t('credits.insufficient.memberTitle') }}
    </template>

    <div class="p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('credits.insufficient.memberDescription') }}
      </p>
    </div>

    <template #footer>
      <Button variant="secondary" size="lg" @click="onClose">
        {{ $t('credits.insufficient.memberCta') }}
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

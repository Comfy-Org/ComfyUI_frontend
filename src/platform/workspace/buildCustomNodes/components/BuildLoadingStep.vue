<template>
  <div
    role="status"
    class="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground"
  >
    <DialogTitle class="sr-only">
      {{ $t('buildCustomNodes.loading') }}
    </DialogTitle>
    <Spinner />
    {{ $t('buildCustomNodes.loading') }}
  </div>
</template>

<script setup lang="ts">
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import Spinner from '@comfyorg/design-system/spinner/Spinner'
</script>

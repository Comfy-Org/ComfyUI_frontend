<template>
  <div class="border-t border-border-default p-4">
    <h3 class="m-0 text-sm font-medium text-base-foreground">
      {{ $t('shareWorkflow.comfyHubTitle') }}
    </h3>
    <p class="mt-1 text-xs text-muted-foreground">
      {{ $t('shareWorkflow.comfyHubDescription') }}
    </p>
    <Button variant="inverted" size="lg" class="w-full" @click="openComfyHub">
      {{ $t('shareWorkflow.comfyHubButton') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

function openComfyHub() {
  window.open(
    'https://comfyhub.comfy.org/upload',
    '_blank',
    'noopener,noreferrer'
  )
}
</script>

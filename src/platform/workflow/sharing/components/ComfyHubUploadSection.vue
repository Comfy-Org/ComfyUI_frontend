<template>
  <div class="flex flex-col gap-4 border-t border-border-default p-4">
    <h3 class="m-0 text-sm font-medium text-base-foreground">
      {{ $t('shareWorkflow.comfyHubTitle') }}
    </h3>
    <p class="m-0 whitespace-pre-line text-xs text-muted-foreground">
      {{ $t('shareWorkflow.comfyHubDescription') }}
    </p>
    <Button variant="inverted" size="lg" class="w-full" @click="openPublish">
      {{ $t('shareWorkflow.comfyHubButton') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useComfyHubPublishDialog } from '@/platform/workflow/sharing/composables/useComfyHubPublishDialog'

const { show } = useComfyHubPublishDialog()

function openPublish() {
  show()
}
</script>

<template>
  <div
    data-testid="publish-profile-prompt"
    class="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4"
  >
    <p class="text-sm text-base-foreground">
      {{ $t('comfyHubPublish.createProfileToPublish') }}
    </p>

    <Button
      variant="textonly"
      size="unset"
      class="flex w-64 items-center gap-4 rounded-2xl border border-dashed border-border-default px-6 py-4 hover:bg-secondary-background-hover"
      @click="emit('requestProfile')"
    >
      <div
        class="flex size-12 items-center justify-center rounded-full border border-dashed border-border-default"
      >
        <i class="icon-[lucide--user] size-4 text-muted-foreground" />
      </div>
      <span class="inline-flex items-center gap-1 text-sm text-base-foreground">
        <i class="icon-[lucide--plus] size-4" />
        {{ $t('comfyHubPublish.createProfileCta') }}
      </span>
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const emit = defineEmits<{
  requestProfile: []
}>()
</script>

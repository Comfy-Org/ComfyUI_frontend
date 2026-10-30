<template>
  <div
    data-testid="publish-profile-prompt"
    class="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4"
  >
    <p class="text-sm text-foreground">
      {{ $t('comfyHubPublish.createProfileToPublish') }}
    </p>

    <Button
      variant="textonly"
      size="unset"
      class="flex w-64 gap-4 rounded-2xl border border-dashed px-6 py-4"
      @click="emit('requestProfile')"
    >
      <div
        class="flex size-12 items-center justify-center rounded-full border border-dashed"
      >
        <i class="icon-[lucide--user] text-muted-foreground" />
      </div>
      <span class="inline-flex items-center gap-1 text-sm text-foreground">
        <i class="icon-[lucide--plus]" />
        {{ $t('comfyHubPublish.createProfileCta') }}
      </span>
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

const emit = defineEmits<{
  requestProfile: []
}>()
</script>

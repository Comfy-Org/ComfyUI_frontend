<template>
  <div class="@container mb-4">
    <div
      role="status"
      class="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-4 @2xl:flex-row @2xl:items-center @2xl:gap-2"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
        <i class="icon-[lucide--circle-alert] shrink-0" />
        <span class="text-sm">
          {{ $t('workspacePanel.members.upsellBanner') }}
        </span>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2 pl-6 @2xl:pl-0">
        <Button variant="secondary" size="lg" @click="$emit('action')">
          {{ $t('workspacePanel.members.upgradeToTeam') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

defineEmits<{
  action: []
}>()
</script>

<template>
  <div
    class="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border-default bg-secondary-background px-4 py-3"
  >
    <p class="text-foreground m-0 text-sm">
      {{
        isActiveSubscription
          ? $t('workspacePanel.members.upsellBannerUpgrade')
          : $t('workspacePanel.members.upsellBannerSubscribe')
      }}
    </p>
    <Button
      variant="muted-textonly"
      class="cursor-pointer text-sm underline"
      @click="$emit('showPlans')"
    >
      {{ $t('workspacePanel.members.viewPlans') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  isActiveSubscription: boolean
}>()

defineEmits<{
  showPlans: []
}>()
</script>

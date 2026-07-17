<template>
  <div
    class="mt-4 flex w-full items-center justify-between gap-4 rounded-2xl border border-interface-stroke bg-secondary-background p-6 max-sm:flex-col max-sm:items-stretch"
  >
    <div class="flex items-center gap-2">
      <i class="icon-[lucide--info] size-4 shrink-0 text-muted-foreground" />
      <p class="m-0 text-sm text-muted-foreground">
        {{
          reactivate
            ? $t('workspacePanel.members.upsellBannerReactivate')
            : $t('workspacePanel.members.upsellBanner')
        }}
      </p>
    </div>
    <Button
      variant="inverted"
      size="lg"
      class="max-sm:w-full"
      @click="$emit('showPlans')"
    >
      {{
        reactivate
          ? $t('workspacePanel.members.reactivateTeam')
          : $t('workspacePanel.members.upgradeToTeam')
      }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { reactivate = false } = defineProps<{
  reactivate?: boolean
}>()

defineEmits<{
  showPlans: []
}>()
</script>

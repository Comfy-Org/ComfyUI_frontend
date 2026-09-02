<template>
  <div
    class="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-base-background"
    data-testid="member-resubscribe-message"
  >
    <div
      class="flex h-12 items-center gap-2 border-b border-border-default p-4"
    >
      <p class="m-0 min-w-0 flex-1 font-inter text-sm text-base-foreground">
        {{ $t('subscription.inactive.memberTitle') }}
      </p>
      <button
        type="button"
        :aria-label="$t('g.close')"
        class="flex size-4 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-base-foreground"
        @click="onClose"
      >
        <i class="pi pi-times text-xs" />
      </button>
    </div>

    <div class="p-4">
      <p class="m-0 font-inter text-sm text-muted-foreground">
        {{ $t('subscription.inactive.memberDescription') }}
      </p>
    </div>

    <div class="flex items-center justify-end p-4">
      <Button variant="secondary" size="lg" @click="onClose">
        {{ $t('subscription.inactive.memberCta') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { onClose } = defineProps<{
  onClose: () => void
}>()
</script>

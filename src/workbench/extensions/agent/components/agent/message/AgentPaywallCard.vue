<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { showAddCredits = true, showUpgrade = true } = defineProps<{
  showAddCredits?: boolean
  showUpgrade?: boolean
}>()
const emit = defineEmits<{
  addCredits: []
  upgradeSubscription: []
}>()
</script>

<template>
  <div
    class="border-agent-border flex w-full flex-col justify-center gap-2 overflow-hidden rounded-lg border bg-modal-card-background p-4 shadow-sm"
  >
    <div class="flex w-full items-start gap-2">
      <span
        aria-hidden="true"
        class="text-agent-danger mt-0.5 icon-[lucide--gauge] size-5 shrink-0"
      />
      <div class="min-w-0 flex-1 text-sm/5">
        <p class="text-agent-fg m-0 font-medium">
          {{ $t('agent.paywall.title') }}
        </p>
        <p class="text-agent-fg-muted m-0">
          {{ $t('agent.paywall.body') }}
        </p>
      </div>
    </div>

    <div
      v-if="showAddCredits || showUpgrade"
      class="flex w-full justify-end gap-2"
    >
      <Button
        v-if="showAddCredits"
        variant="textonly"
        size="sm"
        @click="emit('addCredits')"
      >
        {{ $t('agent.paywall.addCredits') }}
      </Button>
      <Button
        v-if="showUpgrade"
        variant="inverted"
        size="sm"
        @click="emit('upgradeSubscription')"
      >
        {{ $t('agent.paywall.upgradeSubscription') }}
      </Button>
    </div>
  </div>
</template>

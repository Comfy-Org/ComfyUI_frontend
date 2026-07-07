<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import type { ToolRunConfirmation } from '@/platform/agent/composables/useAgentChatPrototype'

const { confirmation } = defineProps<{
  confirmation: ToolRunConfirmation
}>()

const emit = defineEmits<{
  approve: []
  reject: []
}>()
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-lg border border-border-default bg-secondary-background px-4 py-3 text-xs"
  >
    <template v-if="confirmation.status === 'pending'">
      <p class="m-0 text-base-foreground">
        {{ $t('agent.confirmation.prompt') }}
      </p>
      <ul class="m-0 list-disc pl-4">
        <li class="text-base-foreground underline">
          {{ confirmation.workflowName }}
        </li>
      </ul>
      <p class="m-0 text-muted-foreground">
        {{ $t('agent.confirmation.question') }}
      </p>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" @click="emit('reject')">
          {{ $t('agent.confirmation.reject') }}
        </Button>
        <Button variant="inverted" size="sm" @click="emit('approve')">
          {{ $t('agent.confirmation.run') }}
        </Button>
      </div>
    </template>
    <div v-else class="flex items-center gap-1.5 text-muted-foreground">
      <i
        :class="
          confirmation.status === 'approved'
            ? 'icon-[lucide--check]'
            : 'icon-[lucide--x]'
        "
        class="size-3.5"
      />
      <span>
        {{
          confirmation.status === 'approved'
            ? $t('agent.confirmation.approved')
            : $t('agent.confirmation.rejected')
        }}
      </span>
    </div>
  </div>
</template>

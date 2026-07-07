<template>
  <div
    class="flex items-center gap-2 rounded-2xl border border-border-subtle bg-base-background p-3"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <div class="flex items-center gap-2">
        <i
          class="icon-[lucide--triangle-alert] size-4 shrink-0 text-warning-background"
        />
        <span class="text-sm text-base-foreground">
          {{ $t('workspacePanel.members.outOfCredits.title') }}
        </span>
      </div>
      <p class="m-0 pl-6 text-sm text-muted-foreground">
        {{
          resetDate
            ? $t('workspacePanel.members.outOfCredits.bodyWithReset', {
                date: resetDate
              })
            : $t('workspacePanel.members.outOfCredits.body')
        }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <Button variant="textonly" size="lg" @click="$emit('dismiss')">
        {{ $t('workspacePanel.members.outOfCredits.dismiss') }}
      </Button>
      <Button variant="secondary" size="lg" @click="$emit('add-credits')">
        {{ $t('workspacePanel.members.outOfCredits.addCredits') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{ resetDate?: string | null }>()

defineEmits<{ dismiss: []; 'add-credits': [] }>()
</script>

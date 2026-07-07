<script setup lang="ts">
import { DialogDescription, DialogRoot, DialogTitle } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/Button.vue'
import DialogContent from '@/components/ui/DialogContent.vue'
import type { ConflictChoice } from '@/components/agent/safety/safetyTypes'

// Controlled: visibility is driven by the lock's conflictOpen state, and resolving flips
// that state upstream. Not self-dismissible (no update:open handler) — the user must pick.
const { open } = defineProps<{ open: boolean }>()
const emit = defineEmits<{ resolve: [choice: ConflictChoice] }>()

const { t } = useI18n()

function choose(choice: ConflictChoice): void {
  emit('resolve', choice)
}
</script>

<template>
  <DialogRoot :open="open">
    <DialogContent :show-close="false" class="space-y-3">
      <DialogTitle class="text-agent-fg text-base font-semibold">
        {{ t('agent.conflictTitle') }}
      </DialogTitle>
      <DialogDescription class="text-agent-fg-muted text-sm">
        {{ t('agent.conflictBody') }}
      </DialogDescription>
      <div class="flex flex-col gap-2">
        <Button @click="choose('mine')">{{ t('agent.keepMine') }}</Button>
        <Button variant="outline" @click="choose('agent')">
          {{ t('agent.letAgentContinue') }}
        </Button>
        <Button variant="ghost" @click="choose('newtab')">
          {{ t('agent.openNewTab') }}
        </Button>
      </div>
    </DialogContent>
  </DialogRoot>
</template>

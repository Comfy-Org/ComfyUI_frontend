<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import type { PermissionAskPart } from '../../../services/agent/agentMessageParts'

const { part, answering = false } = defineProps<{
  part: PermissionAskPart
  answering?: boolean
}>()
const emit = defineEmits<{
  answer: [askId: string, selection: 'allow' | 'deny']
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="flex w-full flex-col gap-2 overflow-hidden rounded-lg border border-component-node-border bg-secondary-background p-4 shadow-interface"
  >
    <div class="flex min-w-0 flex-col gap-1 text-sm/5">
      <p class="m-0 font-medium text-base-foreground">
        {{
          part.targetKind === 'path'
            ? t('agent.permissionAsk.leadPath')
            : t('agent.permissionAsk.leadHost')
        }}
      </p>
      <code
        class="rounded-sm bg-component-node-background px-1.5 py-0.5 font-mono text-xs/5 wrap-break-word text-base-foreground"
      >
        {{ part.target }}
      </code>
      <!-- The reason is the model's own prose. i18n interpolation runs with
           escapeParameter, which would render its quotes and angle brackets as
           HTML entities, so it is rendered as its own text node. -->
      <p v-if="part.reason" class="m-0 wrap-break-word text-muted-foreground">
        {{ t('agent.permissionAsk.reasonLabel') }} {{ part.reason }}
      </p>
    </div>

    <div class="flex h-6 w-full justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        :disabled="answering"
        :aria-busy="answering || undefined"
        @click="emit('answer', part.askId, 'deny')"
      >
        {{ t('agent.permissionAsk.deny') }}
      </Button>
      <Button
        variant="primary"
        size="sm"
        :disabled="answering"
        :aria-busy="answering || undefined"
        @click="emit('answer', part.askId, 'allow')"
      >
        {{ t('agent.permissionAsk.allow') }}
      </Button>
    </div>
  </div>
</template>

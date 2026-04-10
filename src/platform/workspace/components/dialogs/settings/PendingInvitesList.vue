<template>
  <div>
    <div
      v-for="(invite, index) in invites"
      :key="invite.id"
      :class="
        cn(
          'grid w-full items-center rounded-lg p-2',
          gridCols,
          index % 2 === 1 && 'bg-secondary-background/50'
        )
      "
    >
      <div class="flex items-center gap-3">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-background"
        >
          <span class="text-sm font-bold text-base-foreground">
            {{ getInviteInitial(invite.email) }}
          </span>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-sm text-base-foreground">
            {{ getInviteDisplayName(invite.email) }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ invite.email }}
          </span>
        </div>
      </div>
      <span class="text-sm text-muted-foreground">
        {{ formatDate(invite.inviteDate) }}
      </span>
      <span class="text-sm text-muted-foreground">
        {{ formatDate(invite.expiryDate) }}
      </span>
      <div class="flex items-center justify-end gap-2">
        <Button
          v-tooltip="{
            value: $t('workspacePanel.members.actions.copyLink'),
            showDelay: 300
          }"
          variant="secondary"
          size="md"
          :aria-label="$t('workspacePanel.members.actions.copyLink')"
          @click="$emit('copyLink', invite)"
        >
          <i class="icon-[lucide--link] size-4" />
        </Button>
        <Button
          v-tooltip="{
            value: $t('workspacePanel.members.actions.revokeInvite'),
            showDelay: 300
          }"
          variant="secondary"
          size="md"
          :aria-label="$t('workspacePanel.members.actions.revokeInvite')"
          @click="$emit('revoke', invite)"
        >
          <i class="icon-[lucide--mail-x] size-4" />
        </Button>
      </div>
    </div>
    <div
      v-if="invites.length === 0"
      class="flex w-full items-center justify-center py-8 text-sm text-muted-foreground"
    >
      {{ $t('workspacePanel.members.noInvites') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { PendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  invites: PendingInvite[]
  gridCols: string
}>()

defineEmits<{
  copyLink: [invite: PendingInvite]
  revoke: [invite: PendingInvite]
}>()

const { d } = useI18n()

function getInviteDisplayName(email: string): string {
  return email.split('@')[0]
}

function getInviteInitial(email: string): string {
  return email.charAt(0).toUpperCase()
}

function formatDate(date: Date): string {
  return d(date, { dateStyle: 'medium' })
}
</script>

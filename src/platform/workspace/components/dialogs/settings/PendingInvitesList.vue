<template>
  <div>
    <div
      v-for="invite in invites"
      :key="invite.id"
      :class="
        cn(
          'grid w-full items-center border-b border-interface-stroke/30 p-2 last:border-0',
          gridCols
        )
      "
    >
      <div
        :class="
          cn('flex items-center gap-3', isExpired(invite) && 'opacity-60')
        "
      >
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-background"
        >
          <span class="text-sm text-muted-foreground">
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
      <span
        :class="
          cn(
            'text-sm',
            isExpired(invite)
              ? 'text-warning-background'
              : 'text-muted-foreground'
          )
        "
      >
        {{
          isExpired(invite)
            ? $t('workspacePanel.members.expiredOn', {
                date: formatDate(invite.expiryDate)
              })
            : formatDate(invite.expiryDate)
        }}
      </span>
      <div class="flex items-center justify-end">
        <Menu :items="getInviteMenuItems(invite)" align="end">
          <template #trigger>
            <Button
              size="icon"
              variant="muted-textonly"
              :aria-label="$t('g.moreOptions')"
              icon="icon-[lucide--ellipsis]"
            />
          </template>
        </Menu>
      </div>
    </div>
    <div
      v-if="loaded && invites.length === 0"
      class="flex w-full items-center justify-center py-8 text-sm text-muted-foreground"
    >
      {{
        searchQuery.trim()
          ? $t('workspacePanel.members.noInvitesMatch', {
              query: searchQuery.trim()
            })
          : $t('workspacePanel.members.noInvites')
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { WorkspacePendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  buildInviteLink,
  copyTextSilently
} from '@/platform/workspace/utils/inviteLinks'
import { cn } from '@comfyorg/tailwind-utils'

const toastStore = useToastStore()

const { searchQuery = '', loaded = false } = defineProps<{
  invites: WorkspacePendingInvite[]
  gridCols: string
  searchQuery?: string
  loaded?: boolean
}>()

const emit = defineEmits<{
  resend: [invite: WorkspacePendingInvite]
  revoke: [invite: WorkspacePendingInvite]
}>()

const { d, t } = useI18n()

function getInviteDisplayName(email: string): string {
  return email.split('@')[0]
}

function getInviteInitial(email: string): string {
  return email.charAt(0).toUpperCase()
}

function formatDate(date: Date): string {
  return d(date, { dateStyle: 'medium' })
}

// Same predicate that gates the Copy invite link item: the BE returns a token
// only for non-expired invites, so the marker always explains the missing action.
function isExpired(invite: WorkspacePendingInvite): boolean {
  return !invite.token
}

async function copyInviteLink(invite: WorkspacePendingInvite) {
  if (!invite.token) return
  if (await copyTextSilently(buildInviteLink(invite.token))) {
    toastStore.add({
      severity: 'success',
      summary: t('workspacePanel.inviteLinks.copiedToast'),
      life: 3000
    })
  } else {
    toastStore.add({
      severity: 'error',
      summary: t('workspacePanel.inviteLinks.copyFailedToast')
    })
  }
}

function getInviteMenuItems(invite: WorkspacePendingInvite): MenuItem[] {
  return [
    {
      label: () => t('workspacePanel.members.actions.copyInviteLink'),
      icon: 'icon-[lucide--link]',
      visible: Boolean(invite.token),
      command: () => copyInviteLink(invite)
    },
    {
      label: () => t('workspacePanel.members.actions.resendInvite'),
      icon: 'icon-[lucide--mail-plus]',
      command: () => emit('resend', invite)
    },
    {
      label: () => t('workspacePanel.members.actions.cancelInvite'),
      icon: 'icon-[lucide--mail-x]',
      command: () => emit('revoke', invite)
    }
  ]
}
</script>

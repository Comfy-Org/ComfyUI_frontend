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
      <div class="flex items-center gap-3">
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
      <span class="text-sm text-muted-foreground">
        {{ formatDate(invite.expiryDate) }}
      </span>
      <div class="flex items-center justify-end">
        <MoreButton
          v-slot="{ close }"
          variant="muted-textonly"
          :aria-label="$t('g.moreOptions')"
        >
          <Button
            variant="textonly"
            size="unset"
            :class="menuItemClass"
            @click="
              () => {
                close()
                $emit('resend', invite)
              }
            "
          >
            <i class="icon-[lucide--mail-plus] size-4" />
            <span>{{ $t('workspacePanel.members.actions.resendInvite') }}</span>
          </Button>
          <Button
            variant="textonly"
            size="unset"
            :class="menuItemClass"
            @click="
              () => {
                close()
                $emit('revoke', invite)
              }
            "
          >
            <i class="icon-[lucide--mail-x] size-4" />
            <span>{{ $t('workspacePanel.members.actions.cancelInvite') }}</span>
          </Button>
        </MoreButton>
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

import MoreButton from '@/components/button/MoreButton.vue'
import Button from '@/components/ui/button/Button.vue'
import type { WorkspacePendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

const menuItemClass = 'w-full justify-start rounded-sm px-3 py-2'

const { searchQuery = '', loaded = false } = defineProps<{
  invites: WorkspacePendingInvite[]
  gridCols: string
  searchQuery?: string
  loaded?: boolean
}>()

defineEmits<{
  resend: [invite: WorkspacePendingInvite]
  revoke: [invite: WorkspacePendingInvite]
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

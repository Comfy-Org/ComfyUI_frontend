<template>
  <TableRow
    :data-testid="`invite-row-${invite.id}`"
    class="group hover:bg-transparent"
  >
    <TableCell>
      <div class="flex items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-background"
        >
          <span class="text-sm font-bold text-base-foreground">
            {{ inviteInitial }}
          </span>
        </span>
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-sm text-base-foreground">{{ inviteName }}</span>
          <span class="truncate text-sm text-muted-foreground">
            {{ invite.email }}
          </span>
        </div>
      </div>
    </TableCell>
    <TableCell class="text-sm text-muted-foreground">
      {{ formatDate(invite.inviteDate) }}
    </TableCell>
    <TableCell class="text-sm text-muted-foreground">
      {{ formatDate(invite.expiryDate) }}
    </TableCell>
    <TableCell class="text-right" @click.stop>
      <DropdownMenu
        :entries="menuItems"
        :modal="false"
        content-class="min-w-44"
      >
        <template #button>
          <Button
            v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
            variant="muted-textonly"
            size="icon"
            :aria-label="$t('g.moreOptions')"
          >
            <i class="pi pi-ellipsis-h" />
          </Button>
        </template>
      </DropdownMenu>
    </TableCell>
  </TableRow>
</template>

<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import type { PendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'

const { invite } = defineProps<{ invite: PendingInvite }>()

const emit = defineEmits<{
  resend: [invite: PendingInvite]
  revoke: [invite: PendingInvite]
}>()

const { t, d } = useI18n()

const inviteName = computed(() => invite.email.split('@')[0])
const inviteInitial = computed(() => invite.email.charAt(0).toUpperCase())

const menuItems = computed<MenuItem[]>(() => [
  {
    label: t('workspacePanel.members.actions.resendInvite'),
    command: () => emit('resend', invite)
  },
  {
    label: t('workspacePanel.members.actions.cancelInvite'),
    command: () => emit('revoke', invite)
  }
])

function formatDate(date: Date): string {
  return d(date, { dateStyle: 'medium' })
}
</script>

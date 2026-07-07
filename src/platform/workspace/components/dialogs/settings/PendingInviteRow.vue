<template>
  <TableRow
    :data-testid="`invite-row-${invite.id}`"
    class="group hover:bg-transparent"
  >
    <TableCell>
      <div class="flex items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full"
          :style="{ backgroundColor: userBadgeColor(invite.email) }"
        >
          <span class="text-sm font-bold text-base-foreground">
            {{ inviteInitial }}
          </span>
        </span>
        <span class="min-w-0 flex-1 truncate text-sm text-base-foreground">
          {{ invite.email }}
        </span>
      </div>
    </TableCell>
    <TableCell class="text-sm text-muted-foreground">
      {{ formatDate(invite.inviteDate) }}
    </TableCell>
    <TableCell class="text-sm text-muted-foreground">
      {{ formatDate(invite.expiryDate) }}
    </TableCell>
    <TableCell v-if="canManage" class="text-right" @click.stop>
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
import { userBadgeColor } from '@/platform/workspace/utils/badgeColor'

const { invite, canManage } = defineProps<{
  invite: PendingInvite
  canManage: boolean
}>()

const emit = defineEmits<{
  resend: [invite: PendingInvite]
  revoke: [invite: PendingInvite]
}>()

const { t, d } = useI18n()

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

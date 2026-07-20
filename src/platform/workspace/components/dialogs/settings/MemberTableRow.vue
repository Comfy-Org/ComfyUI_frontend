<template>
  <TableRow
    :data-testid="`member-row-${member.id}`"
    class="group hover:bg-transparent [&:last-child>td]:border-b-0 [&>td]:border-b [&>td]:border-interface-stroke/20"
  >
    <TableCell>
      <div class="flex items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full"
          :style="{
            backgroundColor: userBadgeColor(member.name || member.email)
          }"
        >
          <span class="text-sm font-bold text-base-foreground">
            {{ initial }}
          </span>
        </span>
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-sm text-base-foreground">
            {{ member.name }}
            <span v-if="isCurrentUser" class="text-muted-foreground">
              ({{ $t('g.you') }})
            </span>
          </span>
          <span class="truncate text-sm text-muted-foreground">
            {{ member.email }}
          </span>
        </div>
      </div>
    </TableCell>
    <TableCell class="text-sm text-muted-foreground">
      {{ $t(roleLabelKey(member.role)) }}
    </TableCell>
    <TableCell v-if="canManageMembers" class="text-sm text-muted-foreground">
      {{ lastActivityLabel }}
    </TableCell>
    <TableCell v-if="canManageMembers" class="text-sm tabular-nums">
      <div v-if="member.monthlyCreditLimit" class="flex flex-col gap-1">
        <span class="text-base-foreground">{{ creditsLabel }}</span>
        <div
          class="h-1 overflow-hidden rounded-full bg-secondary-background-hover"
        >
          <div
            class="h-full rounded-full bg-credit"
            :style="{ width: `${creditUsagePercent}%` }"
          />
        </div>
      </div>
      <span v-else class="text-muted-foreground">{{ creditsLabel }}</span>
    </TableCell>
    <TableCell v-if="canManageMembers" class="text-right" @click.stop>
      <DropdownMenu
        v-if="showMenu"
        :entries="menuItems"
        :modal="false"
        content-class="w-56 min-w-0 px-2 py-3 shadow-sm"
        item-class="m-0 h-8 rounded-sm p-2 text-sm leading-none"
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
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'
import { userBadgeColor } from '@/platform/workspace/utils/badgeColor'
import { roleLabelKey } from '@/platform/workspace/utils/roleLabels'
import { formatRelativeTime } from '@/platform/workspace/utils/relativeTime'

const {
  member,
  isCurrentUser,
  canManageMembers = false,
  menuItems = []
} = defineProps<{
  member: WorkspaceMember
  isCurrentUser: boolean
  canManageMembers?: boolean
  menuItems?: MenuItem[]
}>()

const { t } = useI18n()

const initial = computed(() =>
  (member.name || member.email).charAt(0).toUpperCase()
)

const showMenu = computed(() => canManageMembers && menuItems.length > 0)

const lastActivityLabel = computed(() => {
  if (!member.lastActivity) return '—'
  return formatRelativeTime(member.lastActivity, new Date(), {
    justNow: t('workspacePanel.members.activity.justNow'),
    minutesAgo: (n) => t('workspacePanel.members.activity.minutesAgo', { n }),
    hoursAgo: (n) => t('workspacePanel.members.activity.hoursAgo', { n }),
    daysAgo: (n) => t('workspacePanel.members.activity.daysAgo', n)
  })
})

const creditsLabel = computed(() => {
  const used = (member.creditsUsedThisMonth ?? 0).toLocaleString()
  return member.monthlyCreditLimit
    ? `${used} / ${member.monthlyCreditLimit.toLocaleString()}`
    : used
})

const creditUsagePercent = computed(() => {
  if (!member.monthlyCreditLimit) return 0
  return Math.min(
    100,
    ((member.creditsUsedThisMonth ?? 0) / member.monthlyCreditLimit) * 100
  )
})
</script>

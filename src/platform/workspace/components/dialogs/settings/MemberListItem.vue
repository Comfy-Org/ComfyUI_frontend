<template>
  <div
    :data-testid="`member-row-${member.id}`"
    :class="
      cn(
        'grid w-full items-center rounded-lg p-2',
        isSingleSeatPlan ? 'grid-cols-1' : gridCols,
        striped && 'bg-secondary-background/50'
      )
    "
  >
    <div class="flex items-center gap-3">
      <UserAvatar
        class="size-8"
        :photo-url="isCurrentUser ? photoUrl : undefined"
        :pt:icon:class="{ 'text-xl!': !isCurrentUser || !photoUrl }"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="text-sm text-base-foreground">
          {{ member.name }}
          <span v-if="isCurrentUser" class="text-muted-foreground">
            ({{ $t('g.you') }})
          </span>
        </span>
        <span class="text-sm text-muted-foreground">
          {{ member.email }}
        </span>
      </div>
    </div>
    <span
      v-if="showRoleColumn && !isSingleSeatPlan"
      :class="
        cn('text-sm text-muted-foreground', !showCreditsColumn && 'text-right')
      "
    >
      {{
        member.role === 'owner'
          ? $t('workspaceSwitcher.roleOwner')
          : $t('workspaceSwitcher.roleMember')
      }}
    </span>
    <div v-if="showCreditsColumn" class="text-sm tabular-nums">
      <div v-if="hasCreditLimit" class="flex flex-col gap-1">
        <span class="text-base-foreground">{{ creditsLabel }}</span>
        <div
          v-if="hasCreditUsage"
          class="h-1 overflow-hidden rounded-full bg-secondary-background-hover"
          role="progressbar"
          :aria-valuenow="creditUsagePercent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="$t('workspacePanel.members.columns.creditsUsed')"
          :aria-valuetext="creditUsageValueText"
        >
          <div
            class="h-full rounded-full bg-credit"
            :style="{ width: `${creditUsagePercent}%` }"
          />
        </div>
      </div>
      <span v-else class="text-muted-foreground">{{ creditsLabel }}</span>
    </div>
    <div
      v-if="canManageMembers && !isSingleSeatPlan"
      class="flex items-center justify-end"
    >
      <DropdownMenu v-if="menuItems.length > 0" :entries="menuItems">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import Button from '@/components/ui/button/Button.vue'
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

const {
  member,
  showRoleColumn = false,
  showCreditsColumn = false,
  canManageMembers = false,
  isSingleSeatPlan = false,
  striped = false,
  menuItems = []
} = defineProps<{
  member: WorkspaceMember
  isCurrentUser: boolean
  photoUrl?: string
  gridCols: string
  showRoleColumn?: boolean
  showCreditsColumn?: boolean
  canManageMembers?: boolean
  isSingleSeatPlan?: boolean
  striped?: boolean
  menuItems?: MenuItem[]
}>()

const { n, t } = useI18n()
const hasCreditLimit = computed(
  () =>
    member.monthlyCreditLimit !== null &&
    member.monthlyCreditLimit !== undefined
)
const hasCreditUsage = computed(() => member.creditsUsedThisMonth !== undefined)
const creditsLabel = computed(() => {
  const used = member.creditsUsedThisMonth
  const limit = member.monthlyCreditLimit
  if (used === undefined) return limit == null ? '—' : `— / ${n(limit)}`
  return limit == null ? n(used) : `${n(used)} / ${n(limit)}`
})

const creditUsagePercent = computed(() => {
  const used = member.creditsUsedThisMonth
  const limit = member.monthlyCreditLimit
  if (used === undefined || limit == null) return 0
  if (limit === 0) return 100
  return Math.min(100, (used / limit) * 100)
})

const creditUsageValueText = computed(() =>
  t('subscription.monthlyUsageProgress', {
    used: n(member.creditsUsedThisMonth ?? 0),
    total: n(member.monthlyCreditLimit ?? 0)
  })
)
</script>

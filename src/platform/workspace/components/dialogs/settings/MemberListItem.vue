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
      class="text-right text-sm text-muted-foreground"
    >
      {{
        member.role === 'owner'
          ? $t('workspaceSwitcher.roleOwner')
          : member.role === 'admin'
            ? $t('workspaceSwitcher.roleAdmin')
            : $t('workspaceSwitcher.roleMember')
      }}
    </span>
    <div
      v-if="canManageMembers && !isSingleSeatPlan"
      class="flex items-center justify-end"
    >
      <DropdownMenu
        v-if="!isCurrentUser && !isOriginalOwner"
        :entries="menuItems"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import Button from '@/components/ui/button/Button.vue'
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

const {
  showRoleColumn = false,
  canManageMembers = false,
  isSingleSeatPlan = false,
  isOriginalOwner = false,
  striped = false,
  menuItems = []
} = defineProps<{
  member: WorkspaceMember
  isCurrentUser: boolean
  photoUrl?: string
  gridCols: string
  showRoleColumn?: boolean
  canManageMembers?: boolean
  isSingleSeatPlan?: boolean
  isOriginalOwner?: boolean
  striped?: boolean
  menuItems?: MenuItem[]
}>()
</script>

<template>
  <div
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
        <div class="flex items-center gap-2">
          <span class="text-sm text-base-foreground">
            {{ member.name }}
            <span v-if="isCurrentUser" class="text-muted-foreground">
              ({{ $t('g.you') }})
            </span>
          </span>
          <RoleBadge v-if="showRoleBadge" :role="member.role" />
        </div>
        <span class="text-sm text-muted-foreground">
          {{ member.email }}
        </span>
      </div>
    </div>
    <span
      v-if="showDateColumn && !isSingleSeatPlan"
      class="text-right text-sm text-muted-foreground"
    >
      {{ formatDate(member.joinDate) }}
    </span>
    <div
      v-if="canRemoveMembers && !isSingleSeatPlan"
      class="flex items-center justify-end"
    >
      <Button
        v-if="!isCurrentUser"
        v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.moreOptions')"
        @click="$emit('showMenu', $event)"
      >
        <i class="pi pi-ellipsis-h" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import UserAvatar from '@/components/common/UserAvatar.vue'
import Button from '@/components/ui/button/Button.vue'
import RoleBadge from '@/platform/workspace/components/RoleBadge.vue'
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@/utils/tailwindUtil'

const {
  showRoleBadge = false,
  showDateColumn = false,
  canRemoveMembers = false,
  isSingleSeatPlan = false,
  striped = false
} = defineProps<{
  member: WorkspaceMember
  isCurrentUser: boolean
  photoUrl?: string
  gridCols: string
  showRoleBadge?: boolean
  showDateColumn?: boolean
  canRemoveMembers?: boolean
  isSingleSeatPlan?: boolean
  striped?: boolean
}>()

defineEmits<{
  showMenu: [event: Event]
}>()

const { d } = useI18n()

function formatDate(date: Date): string {
  return d(date, { dateStyle: 'medium' })
}
</script>

<template>
  <div
    class="flex size-full flex-col gap-2 rounded-2xl border border-border-default p-6"
  >
    <!-- Section Header -->
    <div class="flex w-full items-center gap-9">
      <div class="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          v-if="uiConfig.showMembersList"
          class="text-base font-semibold text-base-foreground"
        >
          <template v-if="activeView === 'active'">
            {{
              $t('workspacePanel.members.membersCount', {
                count: members.length
              })
            }}
          </template>
          <template v-else-if="permissions.canViewPendingInvites">
            {{
              $t(
                'workspacePanel.members.pendingInvitesCount',
                pendingInvites.length
              )
            }}
          </template>
        </span>
      </div>
      <div v-if="uiConfig.showSearch" class="flex items-start gap-2">
        <SearchBox
          v-model="searchQuery"
          :placeholder="$t('g.search')"
          size="lg"
          class="w-64"
        />
      </div>
    </div>

    <!-- Members Content -->
    <div class="flex min-h-0 flex-1 flex-col">
      <!-- Table Header with Tab Buttons and Column Headers -->
      <div
        v-if="uiConfig.showMembersList"
        :class="
          cn(
            'grid w-full items-center py-2',
            activeView === 'pending'
              ? uiConfig.pendingGridCols
              : uiConfig.headerGridCols
          )
        "
      >
        <!-- Tab buttons in first column -->
        <div class="flex items-center gap-2">
          <Button
            :variant="activeView === 'active' ? 'secondary' : 'muted-textonly'"
            size="md"
            @click="activeView = 'active'"
          >
            {{ $t('workspacePanel.members.tabs.active') }}
          </Button>
          <Button
            v-if="uiConfig.showPendingTab"
            :variant="activeView === 'pending' ? 'secondary' : 'muted-textonly'"
            size="md"
            @click="activeView = 'pending'"
          >
            {{
              $t(
                'workspacePanel.members.tabs.pendingCount',
                pendingInvites.length
              )
            }}
          </Button>
        </div>
        <!-- Date column headers -->
        <template v-if="activeView === 'pending'">
          <Button
            variant="muted-textonly"
            size="sm"
            class="justify-start"
            @click="toggleSort('inviteDate')"
          >
            {{ $t('workspacePanel.members.columns.inviteDate') }}
            <i class="icon-[lucide--chevrons-up-down] size-4" />
          </Button>
          <Button
            variant="muted-textonly"
            size="sm"
            class="justify-start"
            @click="toggleSort('expiryDate')"
          >
            {{ $t('workspacePanel.members.columns.expiryDate') }}
            <i class="icon-[lucide--chevrons-up-down] size-4" />
          </Button>
          <div />
        </template>
        <template v-else>
          <Button
            variant="muted-textonly"
            size="sm"
            class="justify-end"
            @click="toggleSort('joinDate')"
          >
            {{ $t('workspacePanel.members.columns.joinDate') }}
            <i class="icon-[lucide--chevrons-up-down] size-4" />
          </Button>
          <!-- Empty cell for action column header (OWNER only) -->
          <div v-if="permissions.canRemoveMembers" />
        </template>
      </div>

      <!-- Members List -->
      <div class="min-h-0 flex-1 overflow-y-auto">
        <!-- Active Members -->
        <template v-if="activeView === 'active'">
          <!-- Current user (always pinned at top, no date) -->
          <div
            :class="
              cn(
                'grid w-full items-center rounded-lg p-2',
                uiConfig.membersGridCols
              )
            "
          >
            <div class="flex items-center gap-3">
              <UserAvatar
                class="size-8"
                :photo-url="userPhotoUrl"
                :pt:icon:class="{ 'text-xl!': !userPhotoUrl }"
              />
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-base-foreground">
                    {{ userDisplayName }}
                    <span
                      v-if="isPersonalWorkspace"
                      class="text-muted-foreground"
                    >
                      ({{ $t('g.you') }})
                    </span>
                  </span>
                  <div
                    v-if="uiConfig.showRoleBadge"
                    class="py-0.5 px-1.5 text-xs bg-background-muted"
                  >
                    {{ workspaceRole }}
                  </div>
                </div>
                <span class="text-sm text-muted-foreground">
                  {{ userEmail }}
                </span>
              </div>
            </div>
            <!-- Empty cell for grid alignment (no date for current user) -->
            <span v-if="uiConfig.showDateColumn" />
            <!-- Empty cell for action column (can't remove yourself) -->
            <span v-if="permissions.canRemoveMembers" />
          </div>

          <!-- Other members (sorted) -->
          <div
            v-for="(member, index) in filteredMembers"
            :key="member.id"
            :class="
              cn(
                'grid w-full items-center rounded-lg p-2',
                uiConfig.membersGridCols,
                index % 2 === 1 && 'bg-secondary-background/50'
              )
            "
          >
            <div class="flex items-center gap-3">
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-background"
              >
                <span class="text-sm font-bold text-base-foreground">
                  {{ member.name.charAt(0).toUpperCase() }}
                </span>
              </div>
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="text-sm text-base-foreground">
                  {{ member.name }}
                </span>
                <span class="text-sm text-muted-foreground">
                  {{ member.email }}
                </span>
              </div>
            </div>
            <!-- Join date -->
            <span
              v-if="uiConfig.showDateColumn"
              class="text-sm text-muted-foreground text-right"
            >
              {{ formatDate(member.joinDate) }}
            </span>
            <!-- Remove member action (OWNER only) -->
            <div
              v-if="permissions.canRemoveMembers"
              class="flex items-center justify-end"
            >
              <Button
                v-tooltip="{
                  value: $t('g.moreOptions'),
                  showDelay: 300
                }"
                variant="muted-textonly"
                size="icon"
                :aria-label="$t('g.moreOptions')"
                @click="showMemberMenu($event, member)"
              >
                <i class="pi pi-ellipsis-h" />
              </Button>
            </div>
          </div>

          <!-- Member actions menu (shared for all members) -->
          <Menu ref="memberMenu" :model="memberMenuItems" :popup="true" />
        </template>

        <!-- Pending Invites -->
        <template v-else>
          <div
            v-for="(invite, index) in filteredPendingInvites"
            :key="invite.id"
            :class="
              cn(
                'grid w-full items-center rounded-lg p-2',
                uiConfig.pendingGridCols,
                index % 2 === 1 && 'bg-secondary-background/50'
              )
            "
          >
            <!-- Invite info -->
            <div class="flex items-center gap-3">
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-background"
              >
                <span class="text-sm font-bold text-base-foreground">
                  {{ invite.name.charAt(0).toUpperCase() }}
                </span>
              </div>
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="text-sm text-base-foreground">
                  {{ invite.name }}
                </span>
                <span class="text-sm text-muted-foreground">
                  {{ invite.email }}
                </span>
              </div>
            </div>
            <!-- Invite date -->
            <span class="text-sm text-muted-foreground">
              {{ formatDate(invite.inviteDate) }}
            </span>
            <!-- Expiry date -->
            <span class="text-sm text-muted-foreground">
              {{ formatDate(invite.expiryDate) }}
            </span>
            <!-- Actions -->
            <div class="flex items-center justify-end gap-2">
              <Button
                v-tooltip="{
                  value: $t('workspacePanel.members.actions.copyLink'),
                  showDelay: 300
                }"
                variant="secondary"
                size="md"
                :aria-label="$t('workspacePanel.members.actions.copyLink')"
                @click="handleCopyInviteLink(invite)"
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
                @click="handleRevokeInvite(invite)"
              >
                <i class="icon-[lucide--mail-x] size-4" />
              </Button>
            </div>
          </div>
          <div
            v-if="filteredPendingInvites.length === 0"
            class="flex w-full items-center justify-center py-8 text-sm text-muted-foreground"
          >
            {{ $t('workspacePanel.members.noInvites') }}
          </div>
        </template>
      </div>
    </div>
  </div>
  <!-- Personal Workspace Message -->
  <div v-if="isPersonalWorkspace" class="flex items-center">
    <p class="text-sm text-muted-foreground">
      {{ $t('workspacePanel.members.personalWorkspaceMessage') }}
    </p>
    <button
      class="underline bg-transparent border-none cursor-pointer"
      @click="handleCreateWorkspace"
    >
      {{ $t('workspacePanel.members.createNewWorkspace') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import Menu from 'primevue/menu'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchBox from '@/components/common/SearchBox.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type {
  PendingInvite,
  WorkspaceMember
} from '@/platform/workspace/composables/useWorkspace'
import { useWorkspace } from '@/platform/workspace/composables/useWorkspace'
import { useDialogService } from '@/services/dialogService'
import { cn } from '@/utils/tailwindUtil'

const { d, t } = useI18n()
const { userPhotoUrl, userEmail, userDisplayName } = useCurrentUser()
const {
  showRemoveMemberDialog,
  showRevokeInviteDialog,
  showCreateWorkspaceDialog
} = useDialogService()
const {
  members,
  pendingInvites,
  fetchMembers,
  fetchPendingInvites,
  copyInviteLink,
  revokeInvite,
  isPersonalWorkspace,
  permissions,
  uiConfig,
  workspaceRole
} = useWorkspace()

const searchQuery = ref('')
const activeView = ref<'active' | 'pending'>('active')
const sortField = ref<'inviteDate' | 'expiryDate' | 'joinDate'>('inviteDate')
const sortDirection = ref<'asc' | 'desc'>('desc')

const memberMenu = ref<InstanceType<typeof Menu> | null>(null)
const selectedMember = ref<WorkspaceMember | null>(null)

const memberMenuItems = computed(() => [
  {
    label: t('workspacePanel.members.actions.removeMember'),
    icon: 'pi pi-user-minus',
    command: () => {
      if (selectedMember.value) {
        handleRemoveMember(selectedMember.value)
      }
    }
  }
])

function showMemberMenu(event: Event, member: WorkspaceMember) {
  selectedMember.value = member
  memberMenu.value?.toggle(event)
}

async function refreshData() {
  await Promise.all([fetchMembers(), fetchPendingInvites()])
}

onMounted(() => {
  void refreshData()
})

watch(workspaceRole, () => {
  // Reset to active view if pending tab is not available for this role
  if (!uiConfig.value.showPendingTab) {
    activeView.value = 'active'
  }
  void refreshData()
})

// Other members (sorted, excluding current user)
const filteredMembers = computed(() => {
  let result = members.value.filter(
    (member) => member.email.toLowerCase() !== userEmail.value?.toLowerCase()
  )

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
    )
  }

  result.sort((a, b) => {
    const aValue = a.joinDate.getTime()
    const bValue = b.joinDate.getTime()
    return sortDirection.value === 'asc' ? aValue - bValue : bValue - aValue
  })

  return result
})

const filteredPendingInvites = computed(() => {
  let result = [...pendingInvites.value]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (invite) =>
        invite.name.toLowerCase().includes(query) ||
        invite.email.toLowerCase().includes(query)
    )
  }

  const field = sortField.value as 'inviteDate' | 'expiryDate'
  result.sort((a, b) => {
    const aValue = a[field].getTime()
    const bValue = b[field].getTime()
    return sortDirection.value === 'asc' ? aValue - bValue : bValue - aValue
  })

  return result
})

function toggleSort(field: 'inviteDate' | 'expiryDate' | 'joinDate') {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = 'desc'
  }
}

function formatDate(date: Date): string {
  return d(date, { dateStyle: 'medium' })
}

function handleCopyInviteLink(invite: PendingInvite) {
  copyInviteLink(invite.id)
}

function handleRevokeInvite(invite: PendingInvite) {
  showRevokeInviteDialog(() => {
    revokeInvite(invite.id)
  })
}

function handleCreateWorkspace() {
  showCreateWorkspaceDialog()
}

function handleRemoveMember(_member: WorkspaceMember) {
  showRemoveMemberDialog(() => {
    // TODO: Implement actual remove member API call
  })
}
</script>

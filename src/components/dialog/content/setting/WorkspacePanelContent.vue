<template>
  <div class="flex h-full w-full flex-col">
    <div class="pb-8 flex items-center gap-4">
      <WorkspaceProfilePic
        class="size-12 !text-3xl"
        :workspace-name="workspaceName"
      />
      <h1 class="text-3xl text-base-foreground">
        {{ workspaceName }}
      </h1>
    </div>
    <TabsRoot v-model="activeTab">
      <div class="flex w-full items-center">
        <TabsList class="flex items-center gap-2 pb-1">
          <TabsTrigger
            value="plan"
            :class="
              cn(
                tabTriggerBase,
                activeTab === 'plan' ? tabTriggerActive : tabTriggerInactive
              )
            "
          >
            {{ $t('workspacePanel.tabs.planCredits') }}
          </TabsTrigger>
          <TabsTrigger
            value="members"
            :class="
              cn(
                tabTriggerBase,
                activeTab === 'members' ? tabTriggerActive : tabTriggerInactive
              )
            "
          >
            {{
              $t('workspacePanel.tabs.membersCount', {
                count: isInPersonalWorkspace ? 1 : members.length
              })
            }}
          </TabsTrigger>
        </TabsList>

        <Button
          v-if="permissions.canInviteMembers"
          v-tooltip="
            inviteTooltip
              ? { value: inviteTooltip, showDelay: 0 }
              : { value: $t('workspacePanel.inviteMember'), showDelay: 300 }
          "
          variant="muted-textonly"
          size="icon"
          :disabled="isInviteLimitReached"
          :class="isInviteLimitReached && 'opacity-50 cursor-not-allowed'"
          :aria-label="$t('workspacePanel.inviteMember')"
          @click="handleInviteMember"
        >
          <i class="pi pi-plus text-sm" />
        </Button>
        <template v-if="permissions.canAccessWorkspaceMenu">
          <Button
            v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
            variant="muted-textonly"
            size="icon"
            :aria-label="$t('g.moreOptions')"
            @click="menu?.toggle($event)"
          >
            <i class="pi pi-ellipsis-h" />
          </Button>
          <Menu ref="menu" :model="menuItems" :popup="true">
            <template #item="{ item }">
              <div
                v-tooltip="
                  item.disabled && deleteTooltip
                    ? { value: deleteTooltip, showDelay: 0 }
                    : null
                "
                :class="[
                  'flex items-center gap-2 px-3 py-2',
                  item.class,
                  item.disabled ? 'pointer-events-auto' : ''
                ]"
                @click="
                  item.command?.({
                    originalEvent: $event,
                    item
                  })
                "
              >
                <i :class="item.icon" />
                <span>{{ item.label }}</span>
              </div>
            </template>
          </Menu>
        </template>
      </div>

      <TabsContent value="plan" class="mt-4">
        <SubscriptionPanelContentWorkspace />
      </TabsContent>
      <TabsContent value="members" class="mt-4">
        <MembersPanelContent :key="workspaceRole" />
      </TabsContent>
    </TabsRoot>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Menu from 'primevue/menu'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import WorkspaceProfilePic from '@/components/common/WorkspaceProfilePic.vue'
import MembersPanelContent from '@/components/dialog/content/setting/MembersPanelContent.vue'
import Button from '@/components/ui/button/Button.vue'
import SubscriptionPanelContentWorkspace from '@/platform/cloud/subscription/components/SubscriptionPanelContentWorkspace.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'
import { cn } from '@/utils/tailwindUtil'

const tabTriggerBase =
  'flex items-center justify-center shrink-0 px-2.5 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 outline-hidden border-none'
const tabTriggerActive =
  'bg-interface-menu-component-surface-hovered text-text-primary text-bold'
const tabTriggerInactive =
  'bg-transparent text-text-secondary hover:bg-button-hover-surface focus:bg-button-hover-surface'

const { defaultTab = 'plan' } = defineProps<{
  defaultTab?: string
}>()

const { t } = useI18n()
const {
  showLeaveWorkspaceDialog,
  showDeleteWorkspaceDialog,
  showInviteMemberDialog,
  showEditWorkspaceDialog
} = useDialogService()
const workspaceStore = useTeamWorkspaceStore()
const {
  workspaceName,
  members,
  isInviteLimitReached,
  isWorkspaceSubscribed,
  isInPersonalWorkspace
} = storeToRefs(workspaceStore)
const { fetchMembers, fetchPendingInvites } = workspaceStore

const { workspaceRole, permissions, uiConfig } = useWorkspaceUI()
const activeTab = ref('plan')

const menu = ref<InstanceType<typeof Menu> | null>(null)

function handleLeaveWorkspace() {
  showLeaveWorkspaceDialog()
}

function handleDeleteWorkspace() {
  showDeleteWorkspaceDialog()
}

function handleEditWorkspace() {
  showEditWorkspaceDialog()
}

// Disable delete when workspace has an active subscription (to prevent accidental deletion)
// Use workspace's own subscription status, not the global isActiveSubscription
const isDeleteDisabled = computed(
  () =>
    uiConfig.value.workspaceMenuAction === 'delete' &&
    isWorkspaceSubscribed.value
)

const deleteTooltip = computed(() => {
  if (!isDeleteDisabled.value) return null
  const tooltipKey = uiConfig.value.workspaceMenuDisabledTooltip
  return tooltipKey ? t(tooltipKey) : null
})

const inviteTooltip = computed(() => {
  if (!isInviteLimitReached.value) return null
  return t('workspacePanel.inviteLimitReached')
})

function handleInviteMember() {
  if (isInviteLimitReached.value) return
  showInviteMemberDialog()
}

const menuItems = computed(() => {
  const items = []

  // Add edit option for owners
  if (uiConfig.value.showEditWorkspaceMenuItem) {
    items.push({
      label: t('workspacePanel.menu.editWorkspace'),
      icon: 'pi pi-pencil',
      command: handleEditWorkspace
    })
  }

  const action = uiConfig.value.workspaceMenuAction
  if (action === 'delete') {
    items.push({
      label: t('workspacePanel.menu.deleteWorkspace'),
      icon: 'pi pi-trash',
      class: isDeleteDisabled.value
        ? 'text-danger/50 cursor-not-allowed'
        : 'text-danger',
      disabled: isDeleteDisabled.value,
      command: isDeleteDisabled.value ? undefined : handleDeleteWorkspace
    })
  } else if (action === 'leave') {
    items.push({
      label: t('workspacePanel.menu.leaveWorkspace'),
      icon: 'pi pi-sign-out',
      command: handleLeaveWorkspace
    })
  }

  return items
})

onMounted(() => {
  activeTab.value = defaultTab
  fetchMembers()
  fetchPendingInvites()
})
</script>

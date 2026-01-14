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
    <Tabs :value="activeTab" @update:value="setActiveTab">
      <div class="flex w-full items-center">
        <TabList class="w-full">
          <Tab value="plan">{{ $t('workspacePanel.tabs.planCredits') }}</Tab>
          <Tab value="members">{{
            $t('workspacePanel.tabs.membersCount', { count: members.length })
          }}</Tab>
        </TabList>
        <Button
          v-if="permissions.canInviteMembers"
          v-tooltip="
            inviteTooltip
              ? { value: inviteTooltip, showDelay: 0 }
              : { value: $t('workspacePanel.inviteMember'), showDelay: 300 }
          "
          variant="secondary"
          size="lg"
          :disabled="isInviteLimitReached"
          :class="isInviteLimitReached && 'opacity-50 cursor-not-allowed'"
          :aria-label="$t('workspacePanel.inviteMember')"
          @click="handleInviteMember"
        >
          {{ $t('workspacePanel.invite') }}
          <i class="pi pi-plus ml-1 text-sm" />
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

      <TabPanels>
        <TabPanel value="plan">
          <SubscriptionPanelContent />
        </TabPanel>
        <TabPanel value="members">
          <MembersPanelContent :key="workspaceRole" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import Menu from 'primevue/menu'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkspaceProfilePic from '@/components/common/WorkspaceProfilePic.vue'
import MembersPanelContent from '@/components/dialog/content/setting/MembersPanelContent.vue'
import Button from '@/components/ui/button/Button.vue'
import SubscriptionPanelContent from '@/platform/cloud/subscription/components/SubscriptionPanelContent.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useWorkspace } from '@/platform/workspace/composables/useWorkspace'
import { useDialogService } from '@/services/dialogService'

const { defaultTab = 'plan' } = defineProps<{
  defaultTab?: string
}>()

const { t } = useI18n()
const {
  showLeaveWorkspaceDialog,
  showDeleteWorkspaceDialog,
  showInviteMemberDialog
} = useDialogService()
const { isActiveSubscription } = useSubscription()
const {
  activeTab,
  setActiveTab,
  workspaceName,
  workspaceRole,
  members,
  fetchMembers,
  fetchPendingInvites,
  permissions,
  uiConfig,
  isInviteLimitReached
} = useWorkspace()

const menu = ref<InstanceType<typeof Menu> | null>(null)

function handleLeaveWorkspace() {
  showLeaveWorkspaceDialog(() => {
    // TODO: Implement actual leave workspace API call
  })
}

function handleDeleteWorkspace() {
  showDeleteWorkspaceDialog(() => {
    // TODO: Implement actual delete workspace API call
  })
}

const isDeleteDisabled = computed(
  () =>
    uiConfig.value.workspaceMenuAction === 'delete' &&
    isActiveSubscription.value
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
  showInviteMemberDialog((_email: string) => {
    // TODO: Implement actual invite member API call
  })
}

const menuItems = computed(() => {
  const action = uiConfig.value.workspaceMenuAction
  if (!action) return []

  if (action === 'delete') {
    return [
      {
        label: t('workspacePanel.menu.deleteWorkspace'),
        icon: 'pi pi-trash',
        class: isDeleteDisabled.value
          ? 'text-danger/50 cursor-not-allowed'
          : 'text-danger',
        disabled: isDeleteDisabled.value,
        command: isDeleteDisabled.value ? undefined : handleDeleteWorkspace
      }
    ]
  }

  return [
    {
      label: t('workspacePanel.menu.leaveWorkspace'),
      icon: 'pi pi-sign-out',
      command: handleLeaveWorkspace
    }
  ]
})

onMounted(() => {
  setActiveTab(defaultTab)
  fetchMembers()
  fetchPendingInvites()
})
</script>

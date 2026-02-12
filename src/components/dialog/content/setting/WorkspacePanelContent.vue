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
    <Tabs unstyled :value="activeTab" @update:value="setActiveTab">
      <div class="flex w-full items-center">
        <TabList unstyled class="flex w-full gap-2">
          <Tab
            value="plan"
            :class="
              cn(
                buttonVariants({
                  variant: activeTab === 'plan' ? 'secondary' : 'textonly',
                  size: 'md'
                }),
                activeTab === 'plan' && 'text-base-foreground no-underline'
              )
            "
          >
            {{ $t('workspacePanel.tabs.planCredits') }}
          </Tab>
          <Tab
            value="members"
            :class="
              cn(
                buttonVariants({
                  variant: activeTab === 'members' ? 'secondary' : 'textonly',
                  size: 'md'
                }),
                activeTab === 'members' && 'text-base-foreground no-underline',
                'ml-2'
              )
            "
          >
            {{
              $t('workspacePanel.tabs.membersCount', {
                count: isInPersonalWorkspace ? 1 : members.length
              })
            }}
          </Tab>
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
          :disabled="!isSingleSeatPlan && isInviteLimitReached"
          :class="
            !isSingleSeatPlan &&
            isInviteLimitReached &&
            'opacity-50 cursor-not-allowed'
          "
          :aria-label="$t('workspacePanel.inviteMember')"
          @click="handleInviteMember"
        >
          {{ $t('workspacePanel.invite') }}
          <i class="pi pi-plus ml-1 text-sm" />
        </Button>
        <template v-if="permissions.canAccessWorkspaceMenu">
          <Button
            v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
            class="ml-2"
            variant="secondary"
            size="lg"
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
                  item.disabled ? 'pointer-events-auto' : 'cursor-pointer'
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

      <TabPanels unstyled>
        <TabPanel value="plan">
          <SubscriptionPanelContentWorkspace />
        </TabPanel>
        <TabPanel value="members">
          <MembersPanelContent :key="workspaceRole" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
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
import { buttonVariants } from '@/components/ui/button/button.variants'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { TIER_TO_KEY } from '@/platform/cloud/subscription/constants/tierPricing'
import SubscriptionPanelContentWorkspace from '@/platform/cloud/subscription/components/SubscriptionPanelContentWorkspace.vue'
import { cn } from '@/utils/tailwindUtil'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'

const { defaultTab = 'plan' } = defineProps<{
  defaultTab?: string
}>()

const { t } = useI18n()
const {
  showLeaveWorkspaceDialog,
  showDeleteWorkspaceDialog,
  showInviteMemberDialog,
  showInviteMemberUpsellDialog,
  showEditWorkspaceDialog
} = useDialogService()
const { isActiveSubscription, subscription, getMaxSeats } = useBillingContext()

const isSingleSeatPlan = computed(() => {
  if (!isActiveSubscription.value) return true
  const tier = subscription.value?.tier
  if (!tier) return true
  const tierKey = TIER_TO_KEY[tier]
  if (!tierKey) return true
  return getMaxSeats(tierKey) <= 1
})
const workspaceStore = useTeamWorkspaceStore()
const {
  workspaceName,
  members,
  isInviteLimitReached,
  isWorkspaceSubscribed,
  isInPersonalWorkspace
} = storeToRefs(workspaceStore)
const { fetchMembers, fetchPendingInvites } = workspaceStore
const { activeTab, setActiveTab, workspaceRole, permissions, uiConfig } =
  useWorkspaceUI()

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
  if (isSingleSeatPlan.value) return null
  if (!isInviteLimitReached.value) return null
  return t('workspacePanel.inviteLimitReached')
})

function handleInviteMember() {
  if (isSingleSeatPlan.value) {
    showInviteMemberUpsellDialog()
    return
  }
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
  setActiveTab(defaultTab)
  fetchMembers()
  fetchPendingInvites()
})
</script>

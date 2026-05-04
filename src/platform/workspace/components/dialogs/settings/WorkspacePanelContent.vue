<template>
  <div class="flex size-full flex-col">
    <header class="mb-8 flex items-center gap-4">
      <WorkspaceProfilePic
        class="size-12 text-3xl!"
        :workspace-name="workspaceName"
      />
      <h1 class="text-2xl font-semibold text-base-foreground">
        {{ workspaceName }}
      </h1>
    </header>
    <TabsRoot v-model="activeTab">
      <div class="flex w-full items-center justify-between">
        <TabsList class="flex items-center gap-2 pb-1">
          <TabsTrigger value="plan" as-child>
            <Button
              :variant="activeTab === 'plan' ? 'secondary' : 'muted-textonly'"
              size="lg"
            >
              {{ $t('workspacePanel.tabs.planCredits') }}
            </Button>
          </TabsTrigger>
          <TabsTrigger value="members" as-child>
            <Button
              :variant="
                activeTab === 'members' ? 'secondary' : 'muted-textonly'
              "
              size="lg"
            >
              {{
                members.length <= 1
                  ? $t('workspacePanel.tabs.members')
                  : $t('workspacePanel.tabs.membersCount', {
                      count: members.length
                    })
              }}
            </Button>
          </TabsTrigger>
        </TabsList>
        <!-- Plan tab actions -->
        <div v-if="activeTab === 'plan'" class="flex items-center gap-2">
          <Button
            v-if="showSubscribePrompt"
            size="lg"
            variant="inverted"
            @click="handleSubscribeWorkspace"
          >
            {{ $t('subscription.subscribe') }}
          </Button>
          <template
            v-else-if="
              isActiveSubscription && permissions.canManageSubscription
            "
          >
            <template v-if="isCancelled">
              <Button
                size="lg"
                variant="inverted"
                :loading="isResubscribing"
                @click="handleResubscribe"
              >
                {{ $t('subscription.resubscribe') }}
              </Button>
            </template>
            <template v-else>
              <Button
                v-if="!isFreeTierPlan"
                size="lg"
                variant="secondary"
                @click="manageSubscription"
              >
                {{ $t('subscription.managePayment') }}
              </Button>
              <Button size="lg" variant="inverted" @click="handleUpgrade">
                {{ $t('subscription.upgradePlan') }}
              </Button>
              <Button
                v-if="!isFreeTierPlan"
                v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
                variant="secondary"
                size="icon-lg"
                :aria-label="$t('g.moreOptions')"
                @click="planMenu?.toggle($event)"
              >
                <i class="pi pi-ellipsis-h" />
              </Button>
              <Menu ref="planMenu" :model="planMenuItems" :popup="true" />
            </template>
          </template>
        </div>

        <!-- Members tab actions -->
        <div v-if="activeTab === 'members'" class="flex items-center gap-2">
          <Button
            v-if="permissions.canInviteMembers"
            v-tooltip="
              inviteTooltip ? { value: inviteTooltip, showDelay: 0 } : undefined
            "
            variant="secondary"
            size="lg"
            :disabled="isInviteDisabled"
            :class="isInviteDisabled && 'cursor-not-allowed opacity-30'"
            :aria-label="$t('workspacePanel.inviteMember')"
            @click="handleInviteMember"
          >
            {{ $t('workspacePanel.invite') }}
            <i class="pi pi-plus text-sm" />
          </Button>
          <template v-if="permissions.canAccessWorkspaceMenu">
            <Button
              v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
              variant="secondary"
              size="icon-lg"
              :aria-label="$t('g.moreOptions')"
              @click="menu?.toggle($event)"
            >
              <i class="pi pi-ellipsis-h" />
            </Button>
            <Menu ref="menu" :model="menuItems" :popup="true">
              <template #item="{ item }">
                <button
                  v-tooltip="
                    item.disabled && deleteTooltip
                      ? { value: deleteTooltip, showDelay: 0 }
                      : null
                  "
                  type="button"
                  :disabled="!!item.disabled"
                  :class="
                    cn(
                      'flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2',
                      item.class,
                      item.disabled && 'pointer-events-auto cursor-not-allowed'
                    )
                  "
                  @click="
                    item.command?.({
                      originalEvent: $event,
                      item
                    })
                  "
                >
                  <i :class="item.icon" />
                  <span>{{ item.label }}</span>
                </button>
              </template>
            </Menu>
          </template>
        </div>
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

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import MembersPanelContent from '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue'
import Button from '@/components/ui/button/Button.vue'
import { useToast } from 'primevue/usetoast'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { TIER_TO_KEY } from '@/platform/cloud/subscription/constants/tierPricing'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'
import { cn } from '@comfyorg/tailwind-utils'

const { defaultTab = 'plan' } = defineProps<{
  defaultTab?: string
}>()

const { t } = useI18n()
const toast = useToast()
const {
  showLeaveWorkspaceDialog,
  showDeleteWorkspaceDialog,
  showInviteMemberDialog,
  showInviteMemberUpsellDialog,
  showEditWorkspaceDialog,
  showCancelSubscriptionDialog
} = useDialogService()
const {
  isActiveSubscription,
  isFreeTier: isFreeTierPlan,
  subscription,
  getMaxSeats,
  manageSubscription,
  showSubscriptionDialog
} = useBillingContext()
const { showPricingTable } = useSubscriptionDialog()

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

const { workspaceRole, permissions, uiConfig } = useWorkspaceUI()
const activeTab = ref(defaultTab)

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

const isInviteDisabled = computed(
  () => isSingleSeatPlan.value || isInviteLimitReached.value
)

const inviteTooltip = computed(() => {
  if (isSingleSeatPlan.value)
    return t('workspacePanel.members.upgradeToAddTeammates')
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

// Plan tab actions
const isCancelled = computed(
  () =>
    !isInPersonalWorkspace.value && (subscription.value?.isCancelled ?? false)
)

const showSubscribePrompt = computed(() => {
  if (!permissions.value.canManageSubscription) return false
  if (isCancelled.value) return false
  if (isInPersonalWorkspace.value) return !isActiveSubscription.value
  return !isWorkspaceSubscribed.value
})

function handleSubscribeWorkspace() {
  showSubscriptionDialog()
}

const isResubscribing = ref(false)

async function handleResubscribe() {
  isResubscribing.value = true
  try {
    await workspaceApi.resubscribe()
    toast.add({
      severity: 'success',
      summary: t('subscription.resubscribeSuccess'),
      life: 5000
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to resubscribe'
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: message
    })
  } finally {
    isResubscribing.value = false
  }
}

function handleUpgrade() {
  if (isFreeTierPlan.value) showPricingTable()
  else showSubscriptionDialog()
}

const planMenu = ref<InstanceType<typeof Menu> | null>(null)

const planMenuItems = computed(() => [
  {
    label: t('subscription.cancelSubscription'),
    icon: 'pi pi-times',
    command: () => {
      showCancelSubscriptionDialog(subscription.value?.endDate ?? undefined)
    }
  }
])

onMounted(() => {
  fetchMembers()
  fetchPendingInvites()
})
</script>

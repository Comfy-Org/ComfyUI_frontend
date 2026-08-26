<!-- A popover that shows current user information and actions -->
<template>
  <div
    data-testid="current-user-popover"
    class="current-user-popover -m-3 w-80 rounded-lg border border-border-default bg-base-background p-2 shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
  >
    <!-- User Info Section -->
    <div class="mb-4 flex flex-col items-center px-0 py-3">
      <UserAvatar
        class="mb-1"
        :photo-url="userPhotoUrl"
        :pt:icon:class="{
          'text-2xl!': !userPhotoUrl
        }"
        size="large"
      />

      <!-- User Details -->
      <h3 class="my-0 mb-1 truncate text-base font-bold text-base-foreground">
        {{ userDisplayName || $t('g.user') }}
      </h3>
      <p v-if="userEmail" class="my-0 truncate text-sm text-muted">
        {{ userEmail }}
      </p>
      <span
        v-if="subscriptionTierName"
        class="text-foreground my-0 mt-2 rounded-full bg-secondary-background-hover px-2 py-0.5 text-xs font-bold uppercase"
      >
        {{ subscriptionTierName }}
      </span>
    </div>

    <div v-if="showWorkspaceSwitcher" class="relative">
      <Button
        ref="workspaceSwitcherTrigger"
        v-tooltip="{ value: workspaceName, showDelay: 300 }"
        variant="muted-textonly"
        class="flex h-auto w-full items-center justify-between rounded-lg px-4 py-2 hover:bg-secondary-background-hover"
        :aria-expanded="isWorkspaceSwitcherOpen"
        aria-haspopup="menu"
        aria-controls="workspace-switcher-panel"
        data-testid="workspace-switcher-trigger"
        @click="isWorkspaceSwitcherOpen = !isWorkspaceSwitcherOpen"
        @keydown.escape.stop="isWorkspaceSwitcherOpen = false"
      >
        <div class="flex w-0 flex-1 items-center gap-2">
          <WorkspaceProfilePic
            class="size-6 shrink-0 text-xs"
            :workspace-name="workspaceName"
          />
          <span class="truncate text-sm text-base-foreground">
            {{ workspaceName }}
          </span>
        </div>
        <i class="pi pi-chevron-down shrink-0 text-sm text-muted-foreground" />
      </Button>

      <div
        v-if="isWorkspaceSwitcherOpen"
        id="workspace-switcher-panel"
        ref="workspaceSwitcherPanel"
        role="menu"
        class="absolute top-0 right-full z-10 mr-4 rounded-lg border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
        data-testid="workspace-switcher-panel"
      >
        <WorkspaceSwitcherPopover @select="isWorkspaceSwitcherOpen = false" />
      </div>
    </div>

    <!-- Credits Section -->
    <div
      v-if="canAccessSubscriptionFeatures || showWorkspaceSwitcher"
      class="flex items-center gap-2 px-4 py-2"
    >
      <i class="icon-[lucide--coins] text-sm text-credit" />
      <Skeleton v-if="isLoading" width="4rem" height="1.25rem" class="w-full" />
      <span v-else class="text-base font-semibold text-base-foreground">{{
        formattedBalance
      }}</span>
      <Button
        v-tooltip="{ value: $t('credits.unified.tooltip'), showDelay: 300 }"
        variant="muted-textonly"
        size="icon-sm"
        class="mr-auto"
        :aria-label="$t('credits.unified.tooltip')"
        data-testid="credits-info-button"
      >
        <i class="icon-[lucide--circle-help]" />
      </Button>
      <Button
        v-if="showAddCredits"
        variant="secondary"
        size="sm"
        class="text-base-foreground"
        data-testid="add-credits-button"
        @click="handleTopUp"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
    </div>

    <Divider class="mx-0 my-2" />

    <div
      v-if="canAccessSubscriptionFeatures"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="partner-nodes-menu-item"
      @click="handleOpenPartnerNodesInfo"
    >
      <i class="icon-[lucide--tag] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('subscription.partnerNodesCredits')
      }}</span>
    </div>

    <div
      v-if="canAccessSubscriptionFeatures || showWorkspaceSwitcher"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="manage-plan-menu-item"
      @click="handleOpenPlanAndCreditsSettings"
    >
      <i class="icon-[lucide--coins] size-4 text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('credits.credits')
      }}</span>
    </div>

    <div
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="user-settings-menu-item"
      @click="handleOpenUserSettings"
    >
      <i class="icon-[lucide--settings-2] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('userSettings.accountSettings')
      }}</span>
    </div>

    <Divider class="mx-0 my-2" />

    <div
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="logout-menu-item"
      @click="handleLogout"
    >
      <i class="icon-[lucide--log-out] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('auth.signOut.signOut')
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import Divider from 'primevue/divider'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import UserAvatar from '@/components/common/UserAvatar.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import { useTelemetry } from '@/platform/telemetry'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import WorkspaceSwitcherPopover from '@/platform/workspace/components/WorkspaceSwitcherPopover.vue'
import { useWorkspaceTierLabel } from '@/platform/workspace/composables/useWorkspaceTierLabel'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'

const emit = defineEmits<{
  close: []
}>()

const { buildDocsUrl, docsPaths } = useExternalLink()

const { userDisplayName, userEmail, userPhotoUrl, handleSignOut } =
  useCurrentUser()
const settingsDialog = useSettingsDialog()
const dialogService = useDialogService()
const {
  canAccessSubscriptionFeatures,
  tier,
  subscription,
  balance,
  isLoading,
  fetchBalance
} = useBillingContext()
const { formatTierName } = useWorkspaceTierLabel()
const { locale } = useI18n()

const { initState, workspaces, workspaceName } = storeToRefs(
  useTeamWorkspaceStore()
)
const isWorkspaceSwitcherOpen = ref(false)
const workspaceSwitcherTrigger = useTemplateRef('workspaceSwitcherTrigger')
const workspaceSwitcherPanel = useTemplateRef('workspaceSwitcherPanel')

onClickOutside(
  workspaceSwitcherPanel,
  () => {
    isWorkspaceSwitcherOpen.value = false
  },
  { ignore: [workspaceSwitcherTrigger] }
)

const showWorkspaceSwitcher = computed(
  () => initState.value === 'ready' && workspaces.value.length > 0
)

const { canTopUp, canSubscribeSelfServe } = useBillingCapabilities()
const showAddCredits = computed(
  () => canTopUp.value || canSubscribeSelfServe.value
)

const subscriptionTierName = computed(() =>
  formatTierName(tier.value, subscription.value?.duration === 'ANNUAL')
)

const formattedBalance = computed(() => {
  const cents =
    balance.value?.effectiveBalanceMicros ?? balance.value?.amountMicros ?? 0
  return formatCreditsFromCents({
    cents,
    locale: locale.value,
    numberOptions: {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  })
})

const handleOpenUserSettings = () => {
  settingsDialog.show('user')
  emit('close')
}

const handleOpenPlanAndCreditsSettings = () => {
  settingsDialog.show('credits')
  emit('close')
}

const handleTopUp = () => {
  useTelemetry()?.trackAddApiCreditButtonClicked({ source: 'avatar_menu' })
  dialogService.showTopUpCreditsDialog()
  emit('close')
}

const handleOpenPartnerNodesInfo = () => {
  window.open(
    buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true }),
    '_blank'
  )
  emit('close')
}

const handleLogout = async () => {
  await handleSignOut()
  emit('close')
}

onMounted(() => {
  void fetchBalance()
})
</script>

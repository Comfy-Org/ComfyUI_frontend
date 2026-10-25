<!-- A popover that shows current user information and actions -->
<template>
  <div data-testid="current-user-popover" class="current-user-popover p-2">
    <!-- User Info Section -->
    <div class="mb-4 flex flex-col items-center px-0 py-3">
      <UserAvatar
        class="mb-1"
        :photo-url="userPhotoUrl"
        icon-class="size-6"
        size="large"
      />

      <!-- User Details -->
      <h3 class="my-0 mb-1 truncate text-base font-bold text-foreground">
        {{ userDisplayName || $t('g.user') }}
      </h3>
      <p v-if="userEmail" class="my-0 truncate text-sm text-muted-foreground">
        {{ userEmail }}
      </p>
      <Badge
        v-if="subscriptionTierName"
        variant="pill"
        class="mt-2 bg-accent text-xs font-bold uppercase"
      >
        {{ subscriptionTierName }}
      </Badge>
    </div>

    <PopoverRoot v-if="showWorkspaceSwitcher" v-slot="{ close }">
      <PopoverTrigger as-child>
        <Button
          variant="muted-textonly"
          class="flex h-auto w-full justify-between px-4 py-2"
          :tooltip="workspaceName"
          data-testid="workspace-switcher-trigger"
        >
          <div class="flex w-0 flex-1 items-center gap-2">
            <WorkspaceProfilePic
              class="size-6 shrink-0 text-xs"
              :workspace-name
              :subscription-tier="tier"
            />
            <span class="truncate text-sm text-foreground">
              {{ workspaceName }}
            </span>
          </div>
          <i
            class="pi pi-chevron-down shrink-0 text-sm text-muted-foreground"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        :side-offset="16"
        prioritize-position
        dismiss-on-viewport-change
        class="w-auto rounded-lg border-border/50 p-2 shadow-sm"
        data-testid="workspace-switcher-panel"
      >
        <WorkspaceSwitcherPopover @select="close" />
        <PopoverArrow class="fill-background stroke-border/50" />
      </PopoverContent>
    </PopoverRoot>

    <!-- Credits Section -->
    <div
      v-if="canAccessSubscriptionFeatures || showWorkspaceSwitcher"
      class="flex items-center gap-2 px-4 py-2"
    >
      <i class="icon-[lucide--coins] text-sm text-credit" />
      <Skeleton v-if="isLoading" class="h-5 w-16" />
      <span v-else class="text-base font-semibold text-foreground">{{
        formattedBalance
      }}</span>
      <Button
        :tooltip="$t('credits.unified.tooltip')"
        variant="muted-textonly"
        size="icon-sm"
        class="mr-auto"
        :aria-label="$t('credits.unified.tooltip')"
        data-testid="credits-info-button"
      >
        <i class="icon-[lucide--circle-help]" />
      </Button>
      <Button
        v-if="canTopUp"
        variant="secondary"
        size="sm"
        data-testid="add-credits-button"
        :data-dd-action-name="BILLING_ACTION_NAME.addCreditsPopover"
        @click="handleTopUp"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
    </div>

    <div class="mx-0 my-2 border-t" />

    <div
      v-if="canAccessSubscriptionFeatures"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
      data-testid="partner-nodes-menu-item"
      @click="handleOpenPartnerNodesInfo"
    >
      <i class="icon-[lucide--tag] text-muted-foreground" />
      <span class="flex-1 text-foreground">{{
        $t('subscription.partnerNodesCredits')
      }}</span>
    </div>

    <div
      v-if="canAccessSubscriptionFeatures || showWorkspaceSwitcher"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-accent"
      data-testid="manage-plan-menu-item"
      @click="handleOpenPlanAndCreditsSettings"
    >
      <i class="icon-[lucide--coins] text-muted-foreground" />
      <span class="flex-1 text-sm text-foreground">{{
        $t('credits.credits')
      }}</span>
    </div>

    <div
      class="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
      data-testid="user-settings-menu-item"
      @click="handleOpenUserSettings"
    >
      <i class="icon-[lucide--settings-2] text-muted-foreground" />
      <span class="flex-1 text-foreground">{{
        $t('userSettings.accountSettings')
      }}</span>
    </div>

    <div class="mx-0 my-2 border-t" />

    <div
      class="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
      data-testid="logout-menu-item"
      @click="handleLogout"
    >
      <i class="icon-[lucide--log-out] text-muted-foreground" />
      <span class="flex-1 text-foreground">{{
        $t('auth.signOut.signOut')
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PopoverArrow, PopoverRoot, PopoverTrigger } from 'reka-ui'
import Badge from '@comfyorg/design-system/badge/Badge'
import { BILLING_ACTION_NAME } from '@/platform/telemetry/billingActionNames'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import UserAvatar from '@/components/common/UserAvatar.vue'
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import { useTelemetry } from '@/platform/telemetry'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import WorkspaceSwitcherPopover from '@/platform/workspace/components/WorkspaceSwitcherPopover.vue'
import { useWorkspaceTierLabel } from '@/platform/billing/composables/useWorkspaceTierLabel'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'

const emit = defineEmits<{
  close: []
}>()

const { buildDocsUrl, docsPaths } = useExternalLink()

const { userDisplayName, userEmail, userPhotoUrl, handleSignOut } =
  useCurrentUser()
const settingsDialog = useSettingsDialog()
const { showTopUpCreditsDialog } = useBillingDialogs()
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
const showWorkspaceSwitcher = computed(
  () => initState.value === 'ready' && workspaces.value.length > 0
)

const { canTopUp } = useBillingCapabilities()

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
  settingsDialog.show('workspace')
  emit('close')
}

const handleTopUp = () => {
  useTelemetry()?.trackAddApiCreditButtonClicked({ source: 'avatar_menu' })
  showTopUpCreditsDialog({
    source: paymentIntentSourceForAddCreditsClick('avatar_menu')
  })
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

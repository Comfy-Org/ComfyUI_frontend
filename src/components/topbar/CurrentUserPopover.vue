<!-- A popover that shows current user information and actions -->
<template>
  <div class="current-user-popover w-72">
    <!-- User Info Section -->
    <div class="p-3">
      <div class="flex flex-col items-center">
        <UserAvatar
          class="mb-3"
          :photo-url="userPhotoUrl"
          :pt:icon:class="{
            'text-2xl!': !userPhotoUrl
          }"
          size="large"
        />

        <!-- User Details -->
        <h3 class="my-0 mb-1 truncate text-lg font-semibold">
          {{ userDisplayName || $t('g.user') }}
        </h3>
        <p v-if="userEmail" class="my-0 truncate text-sm text-muted">
          {{ userEmail }}
        </p>
      </div>
    </div>

    <div v-if="isActiveSubscription" class="flex items-center justify-between">
      <div class="flex flex-col gap-1">
        <UserCredit text-class="text-2xl" />
        <Button
          :label="$t('subscription.partnerNodesCredits')"
          severity="secondary"
          text
          size="small"
          class="pl-6 p-0 h-auto justify-start"
          :pt="{
            root: {
              class: 'hover:bg-transparent active:bg-transparent'
            }
          }"
          @click="handleOpenPartnerNodesInfo"
        />
      </div>
      <Button
        :label="$t('credits.topUp.topUp')"
        severity="secondary"
        size="small"
        @click="handleTopUp"
      />
    </div>
    <SubscribeButton
      v-else
      :label="$t('subscription.subscribeToComfyCloud')"
      size="small"
      variant="gradient"
      @subscribed="handleSubscribed"
    />

    <Divider class="my-2" />

    <Button
      class="justify-start"
      :label="$t('userSettings.title')"
      icon="pi pi-cog"
      text
      fluid
      severity="secondary"
      @click="handleOpenUserSettings"
    />

    <Button
      v-if="isActiveSubscription"
      class="justify-start"
      :label="$t(planSettingsLabel)"
      icon="pi pi-receipt"
      text
      fluid
      severity="secondary"
      @click="handleOpenPlanAndCreditsSettings"
    />

    <Divider class="my-2" />

    <Button
      class="justify-start"
      :label="$t('auth.signOut.signOut')"
      icon="pi pi-sign-out"
      text
      fluid
      severity="secondary"
      @click="handleLogout"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { onMounted } from 'vue'

import UserAvatar from '@/components/common/UserAvatar.vue'
import UserCredit from '@/components/common/UserCredit.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'

const emit = defineEmits<{
  close: []
}>()

const planSettingsLabel = isCloud
  ? 'settingsCategories.PlanCredits'
  : 'settingsCategories.Credits'

const { userDisplayName, userEmail, userPhotoUrl, handleSignOut } =
  useCurrentUser()
const authActions = useFirebaseAuthActions()
const dialogService = useDialogService()
const { isActiveSubscription, fetchStatus } = useSubscription()

const handleOpenUserSettings = () => {
  dialogService.showSettingsDialog('user')
  emit('close')
}

const handleOpenPlanAndCreditsSettings = () => {
  if (isCloud) {
    dialogService.showSettingsDialog('subscription')
  } else {
    dialogService.showSettingsDialog('credits')
  }

  emit('close')
}

const handleTopUp = () => {
  // Track purchase credits entry from avatar popover
  useTelemetry()?.trackAddApiCreditButtonClicked()
  dialogService.showTopUpCreditsDialog()
  emit('close')
}

const handleOpenPartnerNodesInfo = () => {
  window.open(
    'https://docs.comfy.org/tutorials/api-nodes/overview#api-nodes',
    '_blank'
  )
  emit('close')
}

const handleLogout = async () => {
  await handleSignOut()
  emit('close')
}

const handleSubscribed = async () => {
  await fetchStatus()
}

onMounted(() => {
  void authActions.fetchBalance()
})
</script>

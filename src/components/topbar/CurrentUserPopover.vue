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
            '!text-2xl': !userPhotoUrl
          }"
          size="large"
        />

        <!-- User Details -->
        <h3 class="text-lg font-semibold truncate my-0 mb-1">
          {{ userDisplayName || $t('g.user') }}
        </h3>
        <p v-if="userEmail" class="text-sm text-muted truncate my-0">
          {{ userEmail }}
        </p>
      </div>
    </div>

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

    <Divider class="my-2" />

    <Button
      class="justify-start"
      :label="$t('credits.apiPricing')"
      icon="pi pi-external-link"
      text
      fluid
      severity="secondary"
      @click="handleOpenApiPricing"
    />

    <Divider class="my-2" />

    <div class="w-full flex flex-col gap-2 p-2">
      <div class="text-muted text-sm">
        {{ $t('credits.yourCreditBalance') }}
      </div>
      <div class="flex justify-between items-center">
        <UserCredit text-class="text-2xl" />
        <Button :label="$t('credits.topUp.topUp')" @click="handleTopUp" />
      </div>
    </div>
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
import { useDialogService } from '@/services/dialogService'

const emit = defineEmits<{
  close: []
}>()

const { userDisplayName, userEmail, userPhotoUrl } = useCurrentUser()
const authActions = useFirebaseAuthActions()
const dialogService = useDialogService()

const handleOpenUserSettings = () => {
  dialogService.showSettingsDialog('user')
  emit('close')
}

const handleTopUp = () => {
  dialogService.showTopUpCreditsDialog()
  emit('close')
}

const handleOpenApiPricing = () => {
  window.open('https://docs.comfy.org/tutorials/api-nodes/pricing', '_blank')
  emit('close')
}

onMounted(() => {
  void authActions.fetchBalance()
})
</script>

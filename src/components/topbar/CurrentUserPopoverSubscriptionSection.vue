<template>
  <div v-if="isSubscriptionRequirementMet" class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
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
          @click="handleOpenPartnerInfo"
        />
      </div>
      <Button
        :label="$t('credits.topUp.topUp')"
        severity="secondary"
        size="small"
        @click="handleTopUp"
      />
    </div>

    <Button
      class="justify-start"
      :label="$t('settingsCategories.PlanCredits')"
      icon="pi pi-receipt"
      text
      fluid
      severity="secondary"
      @click="handleOpenPlanSettings"
    />
  </div>
  <SubscribeButton
    v-else
    :label="$t('subscription.subscribeToComfyCloud')"
    size="small"
    variant="gradient"
    class="w-full"
    @subscribed="handleSubscribed"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import UserCredit from '@/components/common/UserCredit.vue'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'

const emit = defineEmits<{
  'top-up': []
  'open-partner-info': []
  'open-plan-settings': []
}>()

const { isSubscriptionRequirementMet, fetchStatus } = useSubscription()

const handleSubscribed = async () => {
  await fetchStatus()
}

const handleTopUp = () => {
  emit('top-up')
}

const handleOpenPartnerInfo = () => {
  emit('open-partner-info')
}

const handleOpenPlanSettings = () => {
  emit('open-plan-settings')
}
</script>

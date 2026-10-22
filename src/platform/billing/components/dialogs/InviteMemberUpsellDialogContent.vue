<template>
  <AppDialogPanel body-class="flex flex-col gap-4" @close="onDismiss">
    <template #title>
      {{
        canAccessSubscriptionFeatures
          ? $t('workspacePanel.inviteUpsellDialog.titleSingleSeat')
          : $t('workspacePanel.inviteUpsellDialog.titleNotSubscribed')
      }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{
        canAccessSubscriptionFeatures
          ? $t('workspacePanel.inviteUpsellDialog.messageSingleSeat')
          : $t('workspacePanel.inviteUpsellDialog.messageNotSubscribed')
      }}
    </p>

    <template #footer>
      <Button variant="muted-textonly" @click="onDismiss">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="primary" size="lg" @click="onUpgrade">
        {{ $t('workspacePanel.inviteUpsellDialog.upgradeToTeam') }}
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useSubscriptionDialogAccess } from '@/platform/billing/subscription/composables/subscriptionDialogAccess'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const { canAccessSubscriptionFeatures } = useBillingContext()
const subscriptionDialog = useSubscriptionDialogAccess()

function onDismiss() {
  dialogStore.closeDialog({ key: 'invite-member-upsell' })
}

function onUpgrade() {
  dialogStore.closeDialog({ key: 'invite-member-upsell' })
  subscriptionDialog.show({
    planMode: 'team',
    reason: 'invite_member_upsell'
  })
}
</script>

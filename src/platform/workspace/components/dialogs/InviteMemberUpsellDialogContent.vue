<template>
  <DialogPanel class="w-full max-w-[512px]" @close="onDismiss">
    <template #title>
      {{
        canAccessSubscriptionFeatures
          ? $t('workspacePanel.inviteUpsellDialog.titleSingleSeat')
          : $t('workspacePanel.inviteUpsellDialog.titleNotSubscribed')
      }}
    </template>

    <div class="flex flex-col gap-4 p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{
          canAccessSubscriptionFeatures
            ? $t('workspacePanel.inviteUpsellDialog.messageSingleSeat')
            : $t('workspacePanel.inviteUpsellDialog.messageNotSubscribed')
        }}
      </p>
    </div>

    <template #footer>
      <Button variant="muted-textonly" @click="onDismiss">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="primary" size="lg" @click="onUpgrade">
        {{ $t('workspacePanel.inviteUpsellDialog.upgradeToTeam') }}
      </Button>
    </template>
  </DialogPanel>
</template>

<script setup lang="ts">
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const { canAccessSubscriptionFeatures } = useBillingContext()
const subscriptionDialog = useSubscriptionDialog()

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

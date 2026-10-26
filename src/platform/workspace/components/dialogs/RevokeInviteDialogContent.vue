<template>
  <AppDialogPanel size="compact" @close="onCancel">
    <template #title>
      {{ $t('workspacePanel.revokeInviteDialog.title') }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('workspacePanel.revokeInviteDialog.message') }}
    </p>

    <template #footer>
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="destructive" size="lg" :loading @click="onRevoke">
        {{ $t('workspacePanel.revokeInviteDialog.revoke') }}
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import Button from '@/components/ui/button/Button.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getErrorMessage } from '@/utils/errorUtil'

const { inviteId } = defineProps<{
  inviteId: string
}>()

const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const { fetchStatus } = useBillingContext()
const toast = useToast()
const { t } = useI18n()
const loading = ref(false)

function onCancel() {
  dialogStore.closeDialog({ key: 'revoke-invite' })
}

async function onRevoke() {
  loading.value = true
  try {
    await workspaceStore.revokeInvite(inviteId)
    void fetchStatus().catch(console.error)
    dialogStore.closeDialog({ key: 'revoke-invite' })
  } catch (error) {
    toast.error(t('g.error'), {
      description: getErrorMessage(error)
    })
  } finally {
    loading.value = false
  }
}
</script>

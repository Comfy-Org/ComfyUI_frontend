<template>
  <DialogPanel class="w-full max-w-[360px]" @close="onCancel">
    <template #title>
      {{ $t('workspacePanel.removeMemberDialog.title') }}
    </template>

    <div class="p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.removeMemberDialog.message') }}
      </p>
    </div>

    <template #footer>
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="destructive" size="lg" :loading @click="onRemove">
        {{ $t('workspacePanel.removeMemberDialog.remove') }}
      </Button>
    </template>
  </DialogPanel>
</template>

<script setup lang="ts">
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import Button from '@/components/ui/button/Button.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const { memberId } = defineProps<{
  memberId: string
}>()

const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const { fetchStatus } = useBillingContext()
const toast = useToast()
const { t } = useI18n()
const loading = ref(false)

function onCancel() {
  dialogStore.closeDialog({ key: 'remove-member' })
}

async function onRemove() {
  loading.value = true
  try {
    await workspaceStore.removeMember(memberId)
    void fetchStatus().catch(console.error)
    toast.success(t('workspacePanel.removeMemberDialog.success'), {
      duration: 2000
    })
    dialogStore.closeDialog({ key: 'remove-member' })
  } catch {
    toast.error(t('workspacePanel.removeMemberDialog.error'))
  } finally {
    loading.value = false
  }
}
</script>

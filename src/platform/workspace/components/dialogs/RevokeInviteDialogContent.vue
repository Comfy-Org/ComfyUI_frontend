<template>
  <div
    class="flex w-full max-w-[360px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('workspacePanel.revokeInviteDialog.title') }}
      </h2>
      <button
        class="focus-visible:ring-secondary-foreground cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="onCancel"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.revokeInviteDialog.message') }}
      </p>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-4 p-4">
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="destructive" size="lg" :loading @click="onRevoke">
        {{ $t('workspacePanel.revokeInviteDialog.revoke') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const { inviteId } = defineProps<{
  inviteId: string
}>()

const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
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
    dialogStore.closeDialog({ key: 'revoke-invite' })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: error instanceof Error ? error.message : undefined,
      life: 3000
    })
  } finally {
    loading.value = false
  }
}
</script>

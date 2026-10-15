<template>
  <DialogPanel class="w-full max-w-lg" @close="onDismiss">
    <template #title>
      {{ $t('workspacePanel.inviteLinks.wrongAccountTitle') }}
    </template>

    <div class="p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{
          authStore.userEmail
            ? $t('workspacePanel.inviteLinks.wrongAccountBody', {
                email: authStore.userEmail
              })
            : $t('workspacePanel.inviteLinks.wrongAccountBodyGeneric')
        }}
      </p>
    </div>

    <template #footer>
      <Button variant="muted-textonly" @click="onDismiss">
        {{ $t('workspacePanel.inviteLinks.invalidDismiss') }}
      </Button>
      <Button variant="secondary" size="lg" :loading @click="onSwitchAccount">
        {{ $t('workspacePanel.inviteLinks.switchAccount') }}
      </Button>
    </template>
  </DialogPanel>
</template>

<script setup lang="ts">
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { capturePreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'

const { inviteToken } = defineProps<{
  inviteToken: string
}>()

const authStore = useAuthStore()
const authActions = useAuthActions()
const dialogStore = useDialogStore()
const loading = ref(false)

function onDismiss() {
  dialogStore.closeDialog({ key: 'invite-wrong-account' })
}

async function onSwitchAccount() {
  loading.value = true
  try {
    // Stash before signing out so the accept re-runs after the next sign-in.
    // If the user cancels the logout's unsaved-changes prompt, the stashed
    // token re-presents this dialog on the next load — the invite is still
    // pending, so that is the honest state.
    capturePreservedQuery(
      PRESERVED_QUERY_NAMESPACES.INVITE,
      { invite: inviteToken },
      ['invite']
    )
    await authActions.logout()
  } finally {
    loading.value = false
  }
}
</script>

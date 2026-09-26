<template>
  <div
    class="flex w-full max-w-lg flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('workspacePanel.inviteLinks.wrongAccountTitle') }}
      </h2>
      <button
        class="focus-visible:ring-secondary-foreground cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="onDismiss"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

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

    <div class="flex items-center justify-end gap-4 p-4">
      <Button variant="muted-textonly" @click="onDismiss">
        {{ $t('workspacePanel.inviteLinks.invalidDismiss') }}
      </Button>
      <Button variant="secondary" size="lg" :loading @click="onSwitchAccount">
        {{ $t('workspacePanel.inviteLinks.switchAccount') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
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

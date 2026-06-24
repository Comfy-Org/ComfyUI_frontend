<template>
  <div
    class="flex w-lg max-w-full flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('workspacePanel.inviteMemberDialog.title') }}
      </h2>
      <button
        class="focus-visible:ring-secondary-foreground cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="onClose"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <div v-if="step === 'form'" class="p-4">
      <InviteMembersForm
        source="settings_members"
        :submit-label="$t('workspacePanel.invite')"
        :cancel-label="$t('g.cancel')"
        :placeholder="$t('workspacePanel.inviteMemberDialog.placeholder')"
        @submitted="onSubmitted"
        @cancel="onClose"
      />
    </div>

    <template v-else>
      <div class="p-4">
        <p class="m-0 text-sm/5 text-muted-foreground">
          {{
            $t(
              'workspacePanel.inviteMemberDialog.invitedMessage',
              { emails: invitedEmails.join(', ') },
              invitedEmails.length
            )
          }}
        </p>
      </div>

      <div class="flex items-center justify-end p-4">
        <Button variant="secondary" size="lg" @click="onClose">
          {{ $t('g.close') }}
        </Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import InviteMembersForm from '@/platform/workspace/components/InviteMembersForm.vue'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

const step = ref<'form' | 'invited'>('form')
const invitedEmails = ref<string[]>([])

function onSubmitted(emails: string[]) {
  invitedEmails.value = emails
  step.value = 'invited'
}

function onClose() {
  dialogStore.closeDialog({ key: 'invite-member' })
}
</script>

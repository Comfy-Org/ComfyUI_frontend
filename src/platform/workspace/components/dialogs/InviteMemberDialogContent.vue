<template>
  <div
    class="flex w-full max-w-lg flex-col rounded-2xl border border-border-default bg-base-background"
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

    <template v-if="step === 'form'">
      <div class="flex flex-col gap-2 p-4">
        <InviteMembersForm
          ref="inviteForm"
          auto-focus
          :show-submit="false"
          source="settings_members"
          :submit-label="$t('workspacePanel.invite')"
          :placeholder="$t('workspacePanel.inviteMemberDialog.placeholder')"
          :max-seats="invitableSeats"
          tags-input-class="min-h-10 w-full bg-secondary-background"
          @submitted="onInvited"
        />
      </div>

      <div class="flex items-center justify-end gap-4 p-4">
        <Button variant="muted-textonly" @click="onClose">
          {{ $t('g.cancel') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          :loading
          :disabled="!canSubmit"
          @click="handleInvite"
        >
          {{ $t('workspacePanel.invite') }}
        </Button>
      </div>
    </template>

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
import { computed, ref } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import Button from '@/components/ui/button/Button.vue'
import InviteMembersForm from '@/platform/workspace/components/InviteMembersForm.vue'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const { maxSeats, occupiedSeats } = useBillingContext()

const step = ref<'form' | 'invited'>('form')
const invitedEmails = ref<string[]>([])
const inviteForm = ref<InstanceType<typeof InviteMembersForm>>()

const invitableSeats = computed(() => {
  if (maxSeats.value === null || occupiedSeats.value === null) return 0
  if (maxSeats.value === 0) return Number.POSITIVE_INFINITY
  return Math.max(0, maxSeats.value - occupiedSeats.value)
})
const canSubmit = computed(
  () =>
    maxSeats.value !== null &&
    occupiedSeats.value !== null &&
    (inviteForm.value?.canSubmit ?? false)
)
const loading = computed(() => inviteForm.value?.loading ?? false)

function onClose() {
  dialogStore.closeDialog({ key: 'invite-member' })
}

function handleInvite() {
  if (maxSeats.value === null || occupiedSeats.value === null) return
  void inviteForm.value?.submit()?.catch(console.error)
}

function onInvited(emails: string[]) {
  invitedEmails.value = emails
  step.value = 'invited'
}
</script>

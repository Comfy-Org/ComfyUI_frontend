<template>
  <div
    class="flex w-full max-w-lg flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2
        class="m-0 flex items-center gap-2 text-sm font-normal text-base-foreground"
      >
        <template v-if="step === 'invited'">
          <i class="pi pi-check-circle size-4 text-success-background" />
          {{
            $t(
              'workspacePanel.inviteLinks.sentTitle',
              { count: invitedEmails.length },
              invitedEmails.length
            )
          }}
        </template>
        <template v-else>
          {{ $t('workspacePanel.inviteMemberDialog.title') }}
        </template>
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
          :max-seats="inviteFormMaxSeats"
          :occupied-seats="inviteFormOccupiedSeats"
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
      <div class="flex flex-col gap-3 p-4">
        <p class="m-0 text-sm/5 text-muted-foreground">
          {{
            copyableRows.length > 0
              ? $t('workspacePanel.inviteLinks.sentLead')
              : $t(
                  'workspacePanel.inviteMemberDialog.invitedMessage',
                  { emails: invitedEmails.join(', ') },
                  invitedEmails.length
                )
          }}
        </p>
        <InviteLinkList :rows="inviteRows" />
      </div>

      <div class="flex items-center justify-end gap-4 p-4">
        <Button
          v-if="copyableRows.length >= 1"
          variant="muted-textonly"
          @click="copyAllLinks"
        >
          {{
            copiedAll
              ? $t('workspacePanel.inviteLinks.copied')
              : $t(
                  'workspacePanel.inviteLinks.copyAll',
                  { count: copyableRows.length },
                  copyableRows.length
                )
          }}
        </Button>
        <Button variant="secondary" size="lg" @click="onClose">
          {{ $t('g.close') }}
        </Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { refAutoReset } from '@vueuse/core'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import InviteLinkList from '@/platform/workspace/components/dialogs/InviteLinkList.vue'
import type { InviteLinkRow } from '@/platform/workspace/components/dialogs/InviteLinkList.vue'
import InviteMembersForm from '@/platform/workspace/components/InviteMembersForm.vue'
import type { WorkspacePendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  buildInviteLink,
  copyTextSilently,
  formatInviteLinksForCopy
} from '@/platform/workspace/utils/inviteLinks'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const { maxSeats, occupiedSeats } = useBillingContext()

const step = ref<'form' | 'invited'>('form')
const invitedEmails = ref<string[]>([])
const createdInvites = ref<WorkspacePendingInvite[]>([])
const inviteTokensById = ref<ReadonlyMap<string, string>>(new Map())
const inviteForm = ref<InstanceType<typeof InviteMembersForm>>()

const copiedAll = refAutoReset(false, 2000)

const inviteFormMaxSeats = computed(() => maxSeats.value)
const inviteFormOccupiedSeats = computed(() => occupiedSeats.value)
const canSubmit = computed(
  () =>
    maxSeats.value !== null &&
    occupiedSeats.value !== null &&
    (inviteForm.value?.canSubmit ?? false)
)
const loading = computed(() => inviteForm.value?.loading ?? false)

const inviteRows = computed<InviteLinkRow[]>(() =>
  createdInvites.value.map((invite) => {
    const token = inviteTokensById.value.get(invite.id)
    return {
      id: invite.id,
      email: invite.email,
      url: token ? buildInviteLink(token) : undefined
    }
  })
)

const copyableRows = computed(() =>
  inviteRows.value.flatMap((row) =>
    row.url ? [{ email: row.email, url: row.url }] : []
  )
)

function onClose() {
  dialogStore.closeDialog({ key: 'invite-member' })
}

function handleInvite() {
  if (maxSeats.value === null || occupiedSeats.value === null) return
  void inviteForm.value?.submit()?.catch(console.error)
}

function onInvited(emails: string[], invites: WorkspacePendingInvite[]) {
  invitedEmails.value = emails
  createdInvites.value = invites
  step.value = 'invited'
  void loadInviteTokens()
}

// The create-invite response deliberately omits the token (see BE-13026;
// cloud workspace_invites.go), so the shareable
// links come from re-fetching the pending-invite list. On failure the rows
// render without a Copy action — the invites themselves were already sent.
async function loadInviteTokens() {
  try {
    const invites = await workspaceStore.fetchPendingInvites()
    inviteTokensById.value = new Map(
      invites.flatMap((invite) =>
        invite.token ? [[invite.id, invite.token] as const] : []
      )
    )
  } catch (error) {
    console.error('Failed to load invite links', error)
  }
}

async function copyAllLinks() {
  if (await copyTextSilently(formatInviteLinksForCopy(copyableRows.value))) {
    copiedAll.value = true
  }
}
</script>

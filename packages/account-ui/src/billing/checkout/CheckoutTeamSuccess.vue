<template>
  <CheckoutSuccess
    :plan
    :copy
    :locale
    :preview-data
    :billing-cycle
    :dark-surface
    :close-demoted="inviting"
    :plan-replaced
    @close="emit('close')"
  >
    <template #plan>
      <slot name="plan" />
    </template>
    <template #details>
      <div v-if="showInviteBlock" class="mt-4 flex w-full flex-col gap-2">
        <h3 class="m-0 text-base font-normal text-base-foreground">
          {{ inviteCopy.title }}
        </h3>
        <p class="m-0 text-sm text-muted-foreground">
          {{ inviteCopy.subtext }}
        </p>
        <div aria-live="polite">
          <p
            v-if="invitedEmails.length > 0"
            ref="invitedMessage"
            tabindex="-1"
            class="m-0 text-sm text-success-background"
          >
            {{
              inviteCopy.invitedMessage(
                invitedEmails.join(', '),
                invitedEmails.length
              )
            }}
          </p>
          <CheckoutInviteForm
            v-else
            :emails
            :copy="inviteCopy"
            :input-class
            :invalid-count="invalidEmails.length"
            :already-invited-count="alreadyInvitedEmails.length"
            :max-seats
            :seat-overage
            @update:emails="onEmailsUpdate"
          />
        </div>
      </div>
    </template>
    <template #actions>
      <CheckoutButton
        v-if="inviting"
        variant="tertiary"
        size="lg"
        class="w-full rounded-lg"
        :disabled="!canSubmit"
        :loading="sending"
        @click="sendInvites"
      >
        {{ inviteCopy.sendInvites }}
      </CheckoutButton>
    </template>
  </CheckoutSuccess>
</template>

<script setup lang="ts">
/**
 * The success step with the team invite the cloud app shows after a
 * multi-seat subscribe: emails in, one invite per address through the
 * workspace invite commands, and a confirmation that replaces the field.
 */
import { computed, nextTick, ref, watch } from 'vue'

import type {
  SubscriptionPreview,
  WorkspaceInvite,
  WorkspaceInviteCommands
} from '@comfyorg/account-core/billing'

import CheckoutButton from './CheckoutButton.vue'
import CheckoutInviteForm from './CheckoutInviteForm.vue'
import CheckoutSuccess from './CheckoutSuccess.vue'
import type { CheckoutInviteCopy, CheckoutSuccessCopy } from './checkoutCopy'
import type { CheckoutBillingCycle, CheckoutPlan } from './checkoutQuote'
import {
  isValidEmail,
  normalizeEmail,
  sanitizeInviteEmails
} from './inviteEmails'

const MAX_INVITES_PER_BATCH = 30

const {
  plan,
  copy,
  inviteCopy,
  locale,
  previewData = null,
  billingCycle = 'monthly',
  darkSurface = false,
  maxSeats,
  occupiedSeats,
  invites,
  planReplaced = false
} = defineProps<{
  plan: CheckoutPlan
  copy: CheckoutSuccessCopy
  inviteCopy: CheckoutInviteCopy
  locale: string
  previewData?: SubscriptionPreview | null
  billingCycle?: CheckoutBillingCycle
  darkSurface?: boolean
  /** The workspace's seat cap (0 means uncapped); null until status loads. */
  maxSeats: number | null
  occupiedSeats: number | null
  invites: WorkspaceInviteCommands
  /** The host names a plan it did not quote here in the `plan` slot. */
  planReplaced?: boolean
}>()

const emit = defineEmits<{
  close: []
  /** Some invites were sent; the seat count the host shows is now stale. */
  invited: [emails: string[]]
  /** The detail for the host's error toast. */
  invitesFailed: [detail: string]
}>()

const emails = ref<string[]>([])
const invitedEmails = ref<string[]>([])
/** Sent across attempts; shown once a batch goes through without failures. */
const sentEmails: string[] = []
const pendingInvites = ref<readonly WorkspaceInvite[]>([])
const sending = ref(false)
const invitedMessage = ref<HTMLElement>()

const showInviteBlock = computed(() => maxSeats === 0 || (maxSeats ?? 0) > 1)

// Read once the workspace turns out to be multi-seat, as the app's form reads
// them on mount.
let pendingInvitesRequest: Promise<void> | undefined
watch(
  showInviteBlock,
  (shown) => {
    if (!shown || pendingInvitesRequest) return
    pendingInvitesRequest = invites.listPendingInvites().then((result) => {
      if (result.status === 'ok') pendingInvites.value = result.value
    })
  },
  { immediate: true }
)
const inviting = computed(
  () => showInviteBlock.value && invitedEmails.value.length === 0
)
const inputClass = computed(() =>
  darkSurface
    ? 'min-h-10 w-full bg-secondary-background px-3 focus-within:bg-secondary-background hover:bg-secondary-background-hover'
    : 'min-h-10 w-full bg-tertiary-background px-3 focus-within:bg-tertiary-background hover:bg-tertiary-background-hover'
)

const invalidEmails = computed(() =>
  emails.value.filter((email) => !isValidEmail(email))
)
const pendingEmails = computed(
  () =>
    new Set(pendingInvites.value.map((invite) => normalizeEmail(invite.email)))
)
const alreadyInvitedEmails = computed(() =>
  emails.value.filter((email) => pendingEmails.value.has(email))
)
const newInviteEmails = computed(() =>
  emails.value.filter((email) => !pendingEmails.value.has(email))
)
const remainingSeats = computed(() => {
  if (maxSeats === null || occupiedSeats === null) return null
  return maxSeats === 0
    ? MAX_INVITES_PER_BATCH
    : Math.max(0, maxSeats - occupiedSeats)
})
const seatOverage = computed(() =>
  remainingSeats.value === null
    ? 0
    : Math.max(0, newInviteEmails.value.length - remainingSeats.value)
)
const canSubmit = computed(
  () =>
    remainingSeats.value !== null &&
    newInviteEmails.value.length > 0 &&
    invalidEmails.value.length === 0 &&
    seatOverage.value === 0
)

function onEmailsUpdate(value: string[]) {
  emails.value = sanitizeInviteEmails(value, MAX_INVITES_PER_BATCH)
}

async function sendInvites() {
  if (sending.value || !canSubmit.value) return
  sending.value = true
  try {
    await pendingInvitesRequest
    if (!canSubmit.value) return
    const batch = [...newInviteEmails.value]
    const results = await Promise.all(
      batch.map((email) => invites.createInvite(email))
    )
    const sent = batch.filter((_, index) => results[index].status === 'ok')
    const failed = batch.filter((_, index) => results[index].status !== 'ok')
    sentEmails.push(...sent)
    if (sent.length > 0) emit('invited', sent)
    if (failed.length > 0) {
      emails.value = failed
      emit('invitesFailed', inviteCopy.failedCount(failed.length))
      return
    }
    invitedEmails.value = [...sentEmails]
    await nextTick()
    invitedMessage.value?.focus()
  } finally {
    sending.value = false
  }
}
</script>

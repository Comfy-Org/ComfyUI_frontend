<template>
  <div class="flex flex-col gap-2">
    <TagsInput
      always-editing
      add-on-paste
      add-on-blur
      :delimiter="EMAIL_DELIMITER"
      :convert-value="normalizeEmail"
      :model-value="emails"
      :class="cn('max-h-48 overflow-y-auto', tagsInputClass)"
      @update:model-value="onEmailsUpdate"
    >
      <TagsInputItem
        v-for="email in emails"
        :key="email"
        :value="email"
        :class="
          cn('rounded-full', !isValidEmail(email) && 'bg-danger/20 text-danger')
        "
      >
        <TagsInputItemText />
        <TagsInputItemDelete />
      </TagsInputItem>
      <TagsInputInput
        :auto-focus="autoFocus"
        class="min-w-0 text-sm"
        :aria-label="placeholder"
        :aria-describedby="describedBy"
        :placeholder="emails.length === 0 ? placeholder : undefined"
      />
    </TagsInput>

    <p
      v-if="invalidEmails.length > 0"
      :id="invalidEmailsHintId"
      role="alert"
      class="text-danger m-0 text-xs"
    >
      {{
        $t(
          'workspacePanel.inviteMemberDialog.invalidEmailCount',
          invalidEmails.length
        )
      }}
    </p>
    <p
      v-if="alreadyInvitedEmails.length > 0"
      :id="pendingInvitesHintId"
      aria-live="polite"
      class="m-0 text-xs text-warning-background"
    >
      <template v-if="alreadyInvitedEmails.length === 1">
        {{ $t('workspacePanel.inviteMemberDialog.pendingInviteSingle') }}
      </template>
      <template v-else>
        {{
          $t('workspacePanel.inviteMemberDialog.pendingInviteCount', {
            count: alreadyInvitedEmails.length
          })
        }}
      </template>
    </p>
    <p
      v-if="seatOverage > 0"
      :id="seatLimitHintId"
      role="alert"
      class="text-danger m-0 text-xs"
    >
      {{
        $t('workspacePanel.inviteMemberDialog.seatLimitExceeded', {
          max: maxSeats,
          overage: seatOverage
        })
      }}
    </p>

    <div
      v-if="showSubmit"
      :class="
        cn('flex', cancelLabel ? 'items-center justify-end gap-4' : 'flex-col')
      "
    >
      <Button
        v-if="cancelLabel"
        variant="muted-textonly"
        size="lg"
        @click="$emit('cancel')"
      >
        {{ cancelLabel }}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        :class="cn(!cancelLabel && 'w-full rounded-lg')"
        :loading
        :disabled="!canSubmit"
        :aria-busy="loading"
        :aria-label="loading ? $t('g.loading') : submitLabel"
        @click="onSubmit"
      >
        {{ submitLabel }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { useToast } from '@/components/ui/toast'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import Button from '@/components/ui/button/Button.vue'
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import { useTelemetry } from '@/platform/telemetry'
import type { WorkspaceInviteMetadata } from '@/platform/telemetry/types'
import type { WorkspacePendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  EMAIL_DELIMITER,
  isValidEmail,
  normalizeEmail,
  sanitizeInviteEmails
} from '@/platform/workspace/utils/inviteEmails'
import { cn } from '@comfyorg/tailwind-utils'

const MAX_INVITES_PER_BATCH = 30

const {
  submitLabel,
  placeholder,
  source,
  cancelLabel,
  maxSeats = MAX_INVITES_PER_BATCH,
  occupiedSeats = 0,
  showSubmit = true,
  autoFocus = false,
  tagsInputClass = 'min-h-10 w-full bg-tertiary-background px-3 focus-within:bg-tertiary-background hover:bg-tertiary-background-hover'
} = defineProps<{
  submitLabel: string
  placeholder: string
  source: WorkspaceInviteMetadata['source']
  cancelLabel?: string
  maxSeats?: number | null
  occupiedSeats?: number | null
  /** Hide the built-in submit row so a parent can place the action elsewhere
   *  (e.g. the team-upgrade success footer); drive it via the exposed submit. */
  showSubmit?: boolean
  /** Focus the email input on mount. Off by default so an embedding dialog
   *  keeps control of its own focus order. */
  autoFocus?: boolean
  tagsInputClass?: string
}>()

const emit = defineEmits<{
  submitted: [emails: string[]]
  cancel: []
}>()

const { t } = useI18n()
const toast = useToast()
const telemetry = useTelemetry()
const workspaceStore = useTeamWorkspaceStore()
const { fetchStatus } = useBillingContext()

const emails = ref<string[]>([])
const invitedEmails = ref<string[]>([])
const loading = ref(false)

const { state: pendingInvites, execute: refreshPendingInvites } = useAsyncState<
  WorkspacePendingInvite[]
>(
  async () => {
    try {
      return await workspaceStore.fetchPendingInvites()
    } catch (error) {
      console.error(error)
      return []
    }
  },
  workspaceStore.pendingInvites,
  { immediate: false }
)
const pendingInvitesRequest = refreshPendingInvites()

const invalidEmailsHintId = useId()
const pendingInvitesHintId = useId()
const seatLimitHintId = useId()

const invalidEmails = computed(() =>
  emails.value.filter((email) => !isValidEmail(email))
)
const pendingInviteEmailSet = computed(
  () =>
    new Set(pendingInvites.value.map((invite) => normalizeEmail(invite.email)))
)
const alreadyInvitedEmails = computed(() =>
  emails.value.filter((email) => pendingInviteEmailSet.value.has(email))
)
const newInviteEmails = computed(() =>
  emails.value.filter((email) => !pendingInviteEmailSet.value.has(email))
)
const remainingSeats = computed(() => {
  if (maxSeats === null || occupiedSeats === null) return null
  return maxSeats === 0
    ? MAX_INVITES_PER_BATCH
    : Math.max(0, maxSeats - occupiedSeats)
})
const seatOverage = computed(() => {
  if (remainingSeats.value === null) return 0
  return Math.max(0, newInviteEmails.value.length - remainingSeats.value)
})
const canSubmit = computed(
  () =>
    remainingSeats.value !== null &&
    emails.value.length > 0 &&
    newInviteEmails.value.length > 0 &&
    invalidEmails.value.length === 0 &&
    seatOverage.value === 0
)

const describedBy = computed(
  () =>
    [
      invalidEmails.value.length > 0 ? invalidEmailsHintId : undefined,
      alreadyInvitedEmails.value.length > 0 ? pendingInvitesHintId : undefined,
      seatOverage.value > 0 ? seatLimitHintId : undefined
    ]
      .filter(Boolean)
      .join(' ') || undefined
)

function onEmailsUpdate(value: string[]) {
  emails.value = sanitizeInviteEmails(value, MAX_INVITES_PER_BATCH)
}

async function onSubmit() {
  if (loading.value || !canSubmit.value) return
  loading.value = true
  try {
    await pendingInvitesRequest
    if (!canSubmit.value) return

    const emailSnapshot = [...newInviteEmails.value]
    if (emailSnapshot.length === 0) return
    const results = await Promise.allSettled(
      emailSnapshot.map((email) => workspaceStore.createInvite(email))
    )
    const failedEmails = emailSnapshot.filter(
      (_, index) => results[index].status === 'rejected'
    )
    const successfulEmails = emailSnapshot.filter(
      (_, index) => results[index].status === 'fulfilled'
    )

    if (successfulEmails.length > 0) {
      invitedEmails.value.push(...successfulEmails)
      telemetry?.trackWorkspaceInviteSent({
        source,
        count: successfulEmails.length
      })
      void fetchStatus().catch(console.error)
    }

    if (failedEmails.length === 0) {
      emit('submitted', [...invitedEmails.value])
      return
    }

    telemetry?.trackWorkspaceInviteFailed({
      source,
      attempted_count: emailSnapshot.length,
      failed_count: failedEmails.length
    })

    emails.value = failedEmails
    toast.error(
      t('workspacePanel.inviteMemberDialog.failedCount', failedEmails.length),
      { duration: 5000 }
    )
  } finally {
    loading.value = false
  }
}

defineExpose({
  submit: onSubmit,
  get canSubmit() {
    return canSubmit.value
  },
  get loading() {
    return loading.value
  }
})
</script>

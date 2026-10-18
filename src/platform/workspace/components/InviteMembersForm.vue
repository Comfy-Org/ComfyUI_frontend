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
          cn(
            'rounded-full',
            !isValidEmail(email) && 'bg-destructive/20 text-destructive'
          )
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
      v-for="hint in validationHints"
      :id="hint.id"
      :key="hint.id"
      :role="hint.role"
      :aria-live="hint.ariaLive"
      :class="cn('m-0 text-xs', hint.class)"
    >
      {{ hint.message }}
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
import { useToast } from '@/components/ui/toast/toastStore'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import Button from '@/components/ui/button/Button.vue'
import TagsInput from '@comfyorg/design-system/tags-input/TagsInput'
import TagsInputInput from '@comfyorg/design-system/tags-input/TagsInputInput'
import TagsInputItem from '@comfyorg/design-system/tags-input/TagsInputItem'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@comfyorg/design-system/tags-input/TagsInputItemText'
import { useTelemetry } from '@/platform/telemetry'
import type { WorkspaceInviteMetadata } from '@/platform/telemetry/types'
import type { WorkspacePendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  EMAIL_DELIMITER,
  isValidEmail,
  normalizeEmail,
  sanitizeInviteEmails
} from '@comfyorg/account-ui/billing/checkout'
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
  tagsInputClass = 'min-h-10 w-full bg-muted px-3 focus-within:bg-muted hover:bg-muted/80'
} = defineProps<{
  submitLabel: string
  placeholder: string
  source: WorkspaceInviteMetadata['source']
  cancelLabel?: string
  maxSeats?: number | null
  occupiedSeats?: number | null
  showSubmit?: boolean
  autoFocus?: boolean
  tagsInputClass?: string
}>()

const emit = defineEmits<{
  submitted: [emails: string[], invites: WorkspacePendingInvite[]]
  cancel: []
}>()

const { t } = useI18n()
const toast = useToast()
const telemetry = useTelemetry()
const workspaceStore = useTeamWorkspaceStore()
const { fetchStatus } = useBillingContext()

const emails = ref<string[]>([])
const invitedEmails = ref<string[]>([])
const invitedInvites = ref<WorkspacePendingInvite[]>([])
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

const validationHints = computed(() =>
  [
    invalidEmails.value.length > 0
      ? {
          id: invalidEmailsHintId,
          role: 'alert',
          class: 'text-destructive',
          message: t(
            'workspacePanel.inviteMemberDialog.invalidEmailCount',
            invalidEmails.value.length
          )
        }
      : null,
    alreadyInvitedEmails.value.length > 0
      ? {
          id: pendingInvitesHintId,
          ariaLive: 'polite' as const,
          class: 'text-warning',
          message:
            alreadyInvitedEmails.value.length === 1
              ? t('workspacePanel.inviteMemberDialog.pendingInviteSingle')
              : t('workspacePanel.inviteMemberDialog.pendingInviteCount', {
                  count: alreadyInvitedEmails.value.length
                })
        }
      : null,
    seatOverage.value > 0
      ? {
          id: seatLimitHintId,
          role: 'alert',
          class: 'text-destructive',
          message: t('workspacePanel.inviteMemberDialog.seatLimitExceeded', {
            max: maxSeats,
            overage: seatOverage.value
          })
        }
      : null
  ].filter((hint) => hint !== null)
)

const describedBy = computed(
  () => validationHints.value.map((hint) => hint.id).join(' ') || undefined
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

    const createdInvites = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    )
    if (successfulEmails.length > 0) {
      invitedEmails.value.push(...successfulEmails)
      invitedInvites.value.push(...createdInvites)
      telemetry?.trackWorkspaceInviteSent({
        source,
        count: successfulEmails.length
      })
      void fetchStatus().catch(console.error)
    }

    if (failedEmails.length === 0) {
      emit('submitted', [...invitedEmails.value], [...invitedInvites.value])
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

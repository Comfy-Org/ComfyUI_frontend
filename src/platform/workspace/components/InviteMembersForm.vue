<template>
  <div class="flex flex-col gap-2">
    <TagsInput
      always-editing
      add-on-paste
      add-on-blur
      :delimiter="EMAIL_DELIMITER"
      :convert-value="normalizeEmail"
      :model-value="emails"
      class="min-h-10 w-full bg-tertiary-background px-3 hover:bg-tertiary-background-hover focus-within:bg-tertiary-background"
      @update:model-value="onEmailsUpdate"
    >
      <TagsInputItem
        v-for="email in emails"
        :key="email"
        :value="email"
        :class="
          cn(
            'rounded-full',
            !EMAIL_REGEX.test(email) && 'bg-danger/20 text-danger'
          )
        "
      >
        <TagsInputItemText />
        <TagsInputItemDelete />
      </TagsInputItem>
      <TagsInputInput
        auto-focus
        class="min-w-0 text-sm"
        :placeholder="emails.length === 0 ? placeholder : undefined"
      />
    </TagsInput>

    <p v-if="invalidEmails.length > 0" class="text-danger m-0 text-xs">
      {{
        $t(
          'workspacePanel.inviteMemberDialog.invalidEmailCount',
          invalidEmails.length
        )
      }}
    </p>
    <p v-else-if="isSeatLimitReached" class="m-0 text-xs text-muted-foreground">
      {{ $t('workspacePanel.inviteMemberDialog.seatLimitReached', maxSeats) }}
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
        @click="onSubmit"
      >
        {{ submitLabel }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import { useTelemetry } from '@/platform/telemetry'
import type { WorkspaceInviteMetadata } from '@/platform/telemetry/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_DELIMITER = /[,\s]+/

const {
  submitLabel,
  placeholder,
  source,
  cancelLabel,
  maxSeats = Number.POSITIVE_INFINITY,
  showSubmit = true
} = defineProps<{
  submitLabel: string
  placeholder: string
  source: WorkspaceInviteMetadata['source']
  cancelLabel?: string
  maxSeats?: number
  /** Hide the built-in submit row so a parent can place the action elsewhere
   *  (e.g. the team-upgrade success footer); drive it via the exposed submit. */
  showSubmit?: boolean
}>()

const emit = defineEmits<{
  submitted: [emails: string[]]
  cancel: []
}>()

const { t } = useI18n()
const toast = useToast()
const telemetry = useTelemetry()
const workspaceStore = useTeamWorkspaceStore()

const emails = ref<string[]>([])
const loading = ref(false)

const invalidEmails = computed(() =>
  emails.value.filter((email) => !EMAIL_REGEX.test(email))
)
const isSeatLimitReached = computed(() => emails.value.length >= maxSeats)
const canSubmit = computed(
  () =>
    emails.value.length > 0 &&
    emails.value.length <= maxSeats &&
    invalidEmails.value.length === 0
)

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function onEmailsUpdate(value: string[]) {
  const nonEmpty = value.filter((email) => email.length > 0)
  emails.value =
    nonEmpty.length > maxSeats ? nonEmpty.slice(0, maxSeats) : nonEmpty
}

async function onSubmit() {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  try {
    const submitted = [...emails.value]
    const results = await Promise.allSettled(
      submitted.map((email) => workspaceStore.createInvite(email))
    )
    const failedEmails = submitted.filter(
      (_, index) => results[index].status === 'rejected'
    )
    const invited = submitted.filter((email) => !failedEmails.includes(email))

    if (invited.length > 0) {
      telemetry?.trackWorkspaceInviteSent({ source, count: invited.length })
    }

    if (failedEmails.length === 0) {
      emit('submitted', submitted)
      return
    }

    emails.value = failedEmails
    toast.add({
      severity: 'error',
      summary: t(
        'workspacePanel.inviteMemberDialog.failedCount',
        failedEmails.length
      )
    })
  } finally {
    loading.value = false
  }
}

defineExpose({ submit: onSubmit, canSubmit, loading })
</script>

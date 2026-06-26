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
        <TagsInput
          always-editing
          add-on-paste
          add-on-blur
          :delimiter="EMAIL_DELIMITER"
          :convert-value="trimEmail"
          :model-value="emails"
          class="min-h-10 w-full bg-secondary-background"
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
            class="text-sm"
            :placeholder="
              emails.length === 0
                ? $t('workspacePanel.inviteMemberDialog.placeholder')
                : undefined
            "
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
          @click="onInvite"
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
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@comfyorg/tailwind-utils'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_DELIMITER = /[,\s]+/

const dialogStore = useDialogStore()
const toast = useToast()
const { t } = useI18n()
const workspaceStore = useTeamWorkspaceStore()

const step = ref<'form' | 'invited'>('form')
const emails = ref<string[]>([])
const invitedEmails = ref<string[]>([])
const loading = ref(false)

const invalidEmails = computed(() =>
  emails.value.filter((email) => !EMAIL_REGEX.test(email))
)
const canSubmit = computed(
  () => emails.value.length > 0 && invalidEmails.value.length === 0
)

function trimEmail(value: string) {
  return value.trim()
}

function onEmailsUpdate(value: string[]) {
  emails.value = value.filter((email) => email.length > 0)
}

function onClose() {
  dialogStore.closeDialog({ key: 'invite-member' })
}

async function onInvite() {
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
    if (failedEmails.length === 0) {
      invitedEmails.value = submitted
      step.value = 'invited'
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
</script>

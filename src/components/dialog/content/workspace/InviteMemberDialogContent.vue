<template>
  <div
    class="flex w-full max-w-[512px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{
          step === 'email'
            ? $t('workspacePanel.inviteMemberDialog.title')
            : $t('workspacePanel.inviteMemberDialog.linkStep.title')
        }}
      </h2>
      <button
        class="cursor-pointer rounded border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary-foreground"
        :aria-label="$t('g.close')"
        @click="onCancel"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <!-- Body: Email Step -->
    <template v-if="step === 'email'">
      <div class="flex flex-col gap-4 px-4 py-4">
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('workspacePanel.inviteMemberDialog.message') }}
        </p>
        <input
          v-model="email"
          type="email"
          class="w-full rounded-lg border border-border-default bg-transparent px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-secondary-foreground"
          :placeholder="$t('workspacePanel.inviteMemberDialog.placeholder')"
        />
      </div>

      <!-- Footer: Email Step -->
      <div class="flex items-center justify-end gap-4 px-4 py-4">
        <Button variant="muted-textonly" @click="onCancel">
          {{ $t('g.cancel') }}
        </Button>
        <Button
          variant="primary"
          size="lg"
          :loading
          :disabled="!isValidEmail"
          @click="onCreateLink"
        >
          {{ $t('workspacePanel.inviteMemberDialog.createLink') }}
        </Button>
      </div>
    </template>

    <!-- Body: Link Step -->
    <template v-else>
      <div class="flex flex-col gap-4 px-4 py-4">
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('workspacePanel.inviteMemberDialog.linkStep.message') }}
        </p>
        <p class="m-0 text-sm font-medium text-base-foreground">
          {{ email }}
        </p>
        <div class="relative">
          <input
            :value="generatedLink"
            readonly
            class="w-full cursor-pointer rounded-lg border border-border-default bg-transparent px-3 py-2 pr-10 text-sm text-base-foreground focus:outline-none"
            @click="onSelectLink"
          />
          <div
            class="absolute right-4 top-2 cursor-pointer"
            @click="onCopyLink"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <g clip-path="url(#clip0_2127_14348)">
                <path
                  d="M2.66634 10.6666C1.93301 10.6666 1.33301 10.0666 1.33301 9.33325V2.66659C1.33301 1.93325 1.93301 1.33325 2.66634 1.33325H9.33301C10.0663 1.33325 10.6663 1.93325 10.6663 2.66659M6.66634 5.33325H13.333C14.0694 5.33325 14.6663 5.93021 14.6663 6.66658V13.3333C14.6663 14.0696 14.0694 14.6666 13.333 14.6666H6.66634C5.92996 14.6666 5.33301 14.0696 5.33301 13.3333V6.66658C5.33301 5.93021 5.92996 5.33325 6.66634 5.33325Z"
                  stroke="white"
                  stroke-width="1.3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>
              <defs>
                <clipPath id="clip0_2127_14348">
                  <rect width="16" height="16" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      <!-- Footer: Link Step -->
      <div class="flex items-center justify-end gap-4 px-4 py-4">
        <Button variant="muted-textonly" @click="onCancel">
          {{ $t('g.cancel') }}
        </Button>
        <Button variant="primary" size="lg" @click="onCopyLink">
          {{ $t('workspacePanel.inviteMemberDialog.linkStep.copyLink') }}
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
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const toast = useToast()
const { t } = useI18n()
const workspaceStore = useTeamWorkspaceStore()

const loading = ref(false)
const email = ref('')
const step = ref<'email' | 'link'>('email')
const generatedLink = ref('')

const isValidEmail = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.value)
})

function onCancel() {
  dialogStore.closeDialog({ key: 'invite-member' })
}

async function onCreateLink() {
  if (!isValidEmail.value) return
  loading.value = true
  try {
    generatedLink.value = await workspaceStore.createInviteLink(email.value)
    step.value = 'link'
  } finally {
    loading.value = false
  }
}

async function onCopyLink() {
  try {
    await navigator.clipboard.writeText(generatedLink.value)
    toast.add({
      severity: 'success',
      summary: t('workspacePanel.inviteMemberDialog.linkCopied'),
      life: 2000
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: t('workspacePanel.inviteMemberDialog.linkCopyFailed'),
      life: 3000
    })
  }
}

function onSelectLink(event: Event) {
  const input = event.target as HTMLInputElement
  input.select()
}
</script>

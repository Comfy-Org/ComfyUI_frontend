<template>
  <div
    class="flex w-full max-w-[360px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('workspacePanel.transferOwnershipDialog.title') }}
      </h2>
      <button
        class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary-foreground"
        :aria-label="$t('g.close')"
        @click="onCancel"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="px-4 py-4">
      <p class="m-0 mb-4 text-sm text-muted-foreground">
        {{ $t('workspacePanel.transferOwnershipDialog.message') }}
      </p>

      <template v-if="eligibleMembers.length > 0">
        <label class="mb-1 block text-xs font-medium text-muted-foreground">
          {{ $t('workspacePanel.transferOwnershipDialog.selectMember') }}
        </label>
        <select
          v-model="selectedMemberId"
          class="w-full rounded-lg border border-border-default bg-base-background px-3 py-2 text-sm text-base-foreground outline-none focus:ring-1 focus:ring-secondary-foreground"
        >
          <option value="" disabled>—</option>
          <option
            v-for="member in eligibleMembers"
            :key="member.id"
            :value="member.id"
          >
            {{ member.name }} ({{ member.email }})
          </option>
        </select>
      </template>
      <p v-else class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.transferOwnershipDialog.noEligibleMembers') }}
      </p>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-4 px-4 py-4">
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="destructive"
        size="lg"
        :loading
        :disabled="!selectedMemberId || eligibleMembers.length === 0"
        @click="onTransfer"
      >
        {{ $t('workspacePanel.transferOwnershipDialog.transfer') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const { t } = useI18n()
const toast = useToast()
const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const { userEmail } = useCurrentUser()
const loading = ref(false)
const selectedMemberId = ref('')

const eligibleMembers = computed(() =>
  workspaceStore.members.filter(
    (m) =>
      m.role !== 'owner' &&
      m.email.toLowerCase() !== userEmail.value?.toLowerCase()
  )
)

function onCancel() {
  dialogStore.closeDialog({ key: 'transfer-ownership' })
}

async function onTransfer() {
  if (!selectedMemberId.value) return

  loading.value = true
  try {
    await workspaceStore.transferOwnership(selectedMemberId.value)
    dialogStore.closeDialog({ key: 'transfer-ownership' })
  } catch (error) {
    console.error(
      '[TransferOwnershipDialog] Failed to transfer ownership:',
      error
    )
    toast.add({
      severity: 'error',
      summary: t('workspacePanel.toast.failedToTransferOwnership'),
      detail: error instanceof Error ? error.message : t('g.unknownError'),
      life: 5000
    })
  } finally {
    loading.value = false
  }
}
</script>

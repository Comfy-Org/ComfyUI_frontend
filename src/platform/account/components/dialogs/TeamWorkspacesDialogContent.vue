<template>
  <Card class="flex w-full max-w-[480px] flex-col">
    <!-- Header -->
    <header class="flex items-start gap-3 p-5 pb-0">
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white"
        aria-hidden="true"
      >
        <i class="icon-[lucide--users] text-lg" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <DialogTitle class="m-0 text-lg">
          {{ $t('teamWorkspacesDialog.title') }}
        </DialogTitle>
        <p class="m-0 text-sm text-muted-foreground">
          {{ subtitle }}
        </p>
      </div>
      <button
        class="-mt-1 cursor-pointer rounded-sm border-none bg-transparent p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="onCancel"
      >
        <i class="icon-[lucide--x]" aria-hidden="true" />
      </button>
    </header>

    <!-- Existing team workspaces -->
    <section
      v-if="ownedTeamWorkspaces.length > 0"
      class="flex flex-col px-5 pt-5"
    >
      <h3
        class="m-0 mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {{ $t('teamWorkspacesDialog.yourTeamWorkspaces') }}
      </h3>
      <ul
        class="m-0 flex max-h-52 list-none flex-col gap-2 overflow-y-auto p-0"
      >
        <li v-for="workspace in ownedTeamWorkspaces" :key="workspace.id">
          <button
            class="flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-transparent px-4 py-3 transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            @click="handleSwitch(workspace.id)"
          >
            <WorkspaceProfilePic
              class="size-9 shrink-0 text-sm"
              :workspace-name="workspace.name"
              :subscription-tier="
                billingState.getSummary(workspace).subscriptionTier
              "
            />
            <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
              <div class="flex items-center gap-1.5">
                <span class="truncate text-left text-sm font-medium">
                  {{ workspace.name }}
                </span>
                <span
                  v-if="tierLabels.get(workspace.id)"
                  class="shrink-0 rounded-full bg-foreground px-1 py-0.5 text-2xs font-bold text-background uppercase"
                >
                  {{ tierLabels.get(workspace.id) }}
                </span>
              </div>
            </div>
            <span class="shrink-0 text-sm font-medium">
              {{ $t('teamWorkspacesDialog.switch') }}
              <i class="icon-[lucide--arrow-right] size-3" aria-hidden="true" />
            </span>
          </button>
        </li>
      </ul>
    </section>

    <!-- Divider -->
    <hr v-if="ownedTeamWorkspaces.length > 0" class="mx-5 my-4" />

    <!-- New workspace section -->
    <div :class="{ 'pt-5': ownedTeamWorkspaces.length === 0 }">
      <p
        v-if="createRefusal"
        class="m-0 px-5 pb-5 text-sm text-muted-foreground"
      >
        {{ createRefusal }}
      </p>
      <section v-else class="flex flex-col gap-3 px-5 pb-5">
        <h3
          class="m-0 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
        >
          {{ $t('teamWorkspacesDialog.newWorkspace') }}
        </h3>
        <div class="flex flex-col gap-2">
          <label for="workspace-name-input" class="text-sm">
            {{ $t('workspacePanel.createWorkspaceDialog.nameLabel') }}
          </label>
          <input
            id="workspace-name-input"
            v-model="workspaceName"
            type="text"
            class="w-full rounded-lg border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none"
            :placeholder="$t('teamWorkspacesDialog.namePlaceholder')"
            :aria-invalid="showNameError"
            :aria-describedby="
              showNameError ? 'workspace-name-error' : undefined
            "
            @keydown.enter="isValidName && !loading && onCreate()"
          />
          <p
            v-if="showNameError"
            id="workspace-name-error"
            class="m-0 text-xs text-destructive"
          >
            {{ $t('teamWorkspacesDialog.nameValidationError') }}
          </p>
        </div>
        <Button
          variant="secondary"
          size="lg"
          class="w-full"
          :loading
          :disabled="!isValidName || loading"
          @click="onCreate"
        >
          <i class="icon-[lucide--plus] size-3" aria-hidden="true" />
          {{ $t('teamWorkspacesDialog.createWorkspace') }}
        </Button>
      </section>
    </div>
  </Card>
</template>

<script setup lang="ts">
import Card from '@comfyorg/design-system/card/Card'
import { useToast } from '@/components/ui/toast/toastStore'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useCreateWorkspaceRefusal } from '@/platform/workspace/composables/useCreateWorkspaceRefusal'
import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import { useWorkspaceTierLabel } from '@/platform/billing/composables/useWorkspaceTierLabel'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getErrorMessage } from '@comfyorg/shared-frontend-utils/errorUtil'

const { onConfirm } = defineProps<{
  onConfirm?: (name: string) => void | Promise<void>
}>()

const DIALOG_KEY = 'team-workspaces'
const SAFE_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\s\-_'.,()&+]*$/

const { t } = useI18n()
const dialogStore = useDialogStore()
const toast = useToast()
const workspaceStore = useTeamWorkspaceStore()
const billingState = useWorkspaceBillingStateStore()
const { switchWorkspace } = useWorkspaceSwitch()
const { getTierLabel } = useWorkspaceTierLabel()
const { sharedWorkspaces, canCreateWorkspace } = storeToRefs(workspaceStore)
const createRefusal = useCreateWorkspaceRefusal()

const loading = ref(false)
const workspaceName = ref('')

const ownedTeamWorkspaces = computed(() =>
  sharedWorkspaces.value.filter((w) => w.role === 'owner')
)

const tierLabels = computed(
  () =>
    new Map(
      ownedTeamWorkspaces.value.map(
        (w) => [w.id, getTierLabel(billingState.getSummary(w))] as const
      )
    )
)

const subtitle = computed(() =>
  ownedTeamWorkspaces.value.length > 0
    ? t('teamWorkspacesDialog.subtitle')
    : t('teamWorkspacesDialog.subtitleNoWorkspaces')
)

const showNameError = computed(
  () => workspaceName.value.length > 0 && !isValidName.value
)

const isValidName = computed(() => {
  const name = workspaceName.value.trim()
  return name.length >= 1 && name.length <= 50 && SAFE_NAME_REGEX.test(name)
})

function onCancel() {
  dialogStore.closeDialog({ key: DIALOG_KEY })
}

async function handleSwitch(workspaceId: string) {
  try {
    await switchWorkspace(workspaceId)
    dialogStore.closeDialog({ key: DIALOG_KEY })
  } catch (error) {
    toast.error(t('workspaceSwitcher.failedToSwitch'), {
      description: getErrorMessage(error) ?? t('g.unknownError')
    })
  }
}

async function onCreate() {
  if (!canCreateWorkspace.value || !isValidName.value || loading.value) return
  loading.value = true
  try {
    const name = workspaceName.value.trim()
    try {
      await workspaceStore.createWorkspace(name)
    } catch (error) {
      toast.error(t('workspacePanel.toast.failedToCreateWorkspace'), {
        description: getErrorMessage(error) ?? t('g.unknownError')
      })
      return
    }
    try {
      await onConfirm?.(name)
    } catch (error) {
      toast.error(t('teamWorkspacesDialog.confirmCallbackFailed'), {
        description: getErrorMessage(error) ?? t('g.unknownError')
      })
    }
    dialogStore.closeDialog({ key: DIALOG_KEY })
  } finally {
    loading.value = false
  }
}
</script>

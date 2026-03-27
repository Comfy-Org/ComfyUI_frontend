<template>
  <section
    class="flex w-full max-w-[480px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <header class="flex items-start gap-3 p-5 pb-0">
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-background text-white"
        aria-hidden="true"
      >
        <i class="icon-[lucide--users] text-lg" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <h2 class="m-0 text-lg font-semibold text-base-foreground">
          {{ $t('teamWorkspacesDialog.title') }}
        </h2>
        <p class="m-0 text-sm text-muted-foreground">
          {{
            ownedTeamWorkspaces.length > 0
              ? $t('teamWorkspacesDialog.subtitle')
              : $t('teamWorkspacesDialog.subtitleNoWorkspaces')
          }}
        </p>
      </div>
      <button
        class="focus-visible:ring-secondary-foreground -mt-1 cursor-pointer rounded-sm border-none bg-transparent p-2 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="onCancel"
      >
        <i class="pi pi-times size-4" aria-hidden="true" />
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
            class="focus-visible:ring-secondary-foreground flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border-default bg-transparent px-4 py-3 transition-colors hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:outline-none"
            @click="handleSwitch(workspace.id)"
          >
            <WorkspaceProfilePic
              class="size-9 shrink-0 text-sm"
              :workspace-name="workspace.name"
            />
            <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
              <div class="flex items-center gap-1.5">
                <span
                  class="truncate text-left text-sm font-medium text-base-foreground"
                >
                  {{ workspace.name }}
                </span>
                <span
                  v-if="tierLabels.get(workspace.id)"
                  class="shrink-0 rounded-full bg-base-foreground px-1 py-0.5 text-2xs font-bold text-base-background uppercase"
                >
                  {{ tierLabels.get(workspace.id) }}
                </span>
              </div>
            </div>
            <span class="text-primary-foreground shrink-0 text-sm font-medium">
              {{ $t('teamWorkspacesDialog.switch') }}
              <i class="pi pi-arrow-right text-xs" aria-hidden="true" />
            </span>
          </button>
        </li>
      </ul>
    </section>

    <!-- Divider -->
    <hr
      v-if="ownedTeamWorkspaces.length > 0"
      class="mx-5 my-4 border-border-default"
    />

    <!-- New workspace section -->
    <section
      class="flex flex-col gap-3 px-5 pb-5"
      :class="{ 'pt-5': ownedTeamWorkspaces.length === 0 }"
    >
      <h3
        class="m-0 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {{ $t('teamWorkspacesDialog.newWorkspace') }}
      </h3>
      <div class="flex flex-col gap-2">
        <label for="workspace-name-input" class="text-sm text-base-foreground">
          {{ $t('workspacePanel.createWorkspaceDialog.nameLabel') }}
        </label>
        <input
          id="workspace-name-input"
          v-model="workspaceName"
          type="text"
          class="focus:ring-secondary-foreground w-full rounded-lg border border-border-default bg-transparent px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus:ring-1 focus:outline-none"
          :placeholder="$t('teamWorkspacesDialog.namePlaceholder')"
          :aria-invalid="workspaceName.length > 0 && !isValidName"
          :aria-describedby="
            workspaceName.length > 0 && !isValidName
              ? 'workspace-name-error'
              : undefined
          "
          @keydown.enter="isValidName && !loading && onCreate()"
        />
        <p
          v-if="workspaceName.length > 0 && !isValidName"
          id="workspace-name-error"
          class="text-danger m-0 text-xs"
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
        <i class="pi pi-plus text-xs" aria-hidden="true" />
        {{ $t('teamWorkspacesDialog.createWorkspace') }}
      </Button>
    </section>
  </section>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import { useWorkspaceTierLabel } from '@/platform/workspace/composables/useWorkspaceTierLabel'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const { onConfirm } = defineProps<{
  onConfirm?: (name: string) => void | Promise<void>
}>()

const DIALOG_KEY = 'team-workspaces'
const SAFE_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\s\-_'.,()&+]*$/

const { t } = useI18n()
const dialogStore = useDialogStore()
const toast = useToast()
const workspaceStore = useTeamWorkspaceStore()
const { switchWorkspace } = useWorkspaceSwitch()
const { getTierLabel } = useWorkspaceTierLabel()
const { sharedWorkspaces } = storeToRefs(workspaceStore)

const loading = ref(false)
const workspaceName = ref('')

const ownedTeamWorkspaces = computed(() =>
  sharedWorkspaces.value.filter((w) => w.role === 'owner')
)

const tierLabels = computed(
  () =>
    new Map(
      ownedTeamWorkspaces.value.map((w) => [w.id, getTierLabel(w)] as const)
    )
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
    toast.add({
      severity: 'error',
      summary: t('workspaceSwitcher.failedToSwitch'),
      detail: error instanceof Error ? error.message : t('g.unknownError')
    })
  }
}

async function onCreate() {
  if (!isValidName.value || loading.value) return
  loading.value = true
  const name = workspaceName.value.trim()
  try {
    await workspaceStore.createWorkspace(name)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('workspacePanel.toast.failedToCreateWorkspace'),
      detail: error instanceof Error ? error.message : t('g.unknownError')
    })
    loading.value = false
    return
  }
  try {
    await onConfirm?.(name)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('teamWorkspacesDialog.confirmCallbackFailed'),
      detail: error instanceof Error ? error.message : t('g.unknownError')
    })
  }
  dialogStore.closeDialog({ key: DIALOG_KEY })
  loading.value = false
}
</script>

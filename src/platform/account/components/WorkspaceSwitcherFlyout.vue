<template>
  <div class="flex w-60 flex-col gap-1" :class="{ 'pt-1': showSearch }">
    <div v-if="showSearch" class="flex flex-col gap-2">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="$t('workspaceSwitcher.searchPlaceholder')"
        :aria-label="$t('workspaceSwitcher.searchPlaceholder')"
        class="h-6 w-full border-none bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        data-testid="workspace-switcher-search"
      />
      <div class="mx-1 mb-1 border-t" />
    </div>

    <div
      class="flex scrollbar-custom max-h-[294px] min-h-0 flex-col gap-2 overflow-y-auto py-1"
      data-testid="workspace-switcher-list"
    >
      <template v-if="isFetchingWorkspaces">
        <div
          v-for="i in 2"
          :key="i"
          class="flex animate-pulse items-center gap-3 p-1"
        >
          <div class="size-8 rounded-md bg-secondary" />
          <div class="flex flex-col">
            <div class="h-3 w-24 rounded-sm bg-secondary" />
            <div class="h-2 w-14 rounded-sm bg-secondary" />
          </div>
        </div>
      </template>

      <div
        v-else-if="hasLoadError"
        class="flex flex-col gap-1 px-2 py-3 text-sm"
        data-testid="workspace-switcher-error"
      >
        <span class="text-muted-foreground">{{
          $t('workspaceSwitcher.loadFailed')
        }}</span>
        <Button
          variant="textonly"
          size="unset"
          class="self-start p-0 hover:bg-transparent"
          @click="retryLoad"
        >
          {{ $t('workspaceSwitcher.tryAgain') }}
        </Button>
      </div>

      <p
        v-else-if="noMatchQuery"
        class="m-0 px-2 py-3 text-sm text-muted-foreground"
      >
        {{ $t('workspaceSwitcher.noResults', { query: noMatchQuery }) }}
      </p>

      <template v-else>
        <Button
          v-for="workspace in filteredWorkspaces"
          :key="workspace.id"
          variant="textonly"
          size="unset"
          class="w-full justify-start gap-3 p-1 text-left font-normal"
          :disabled="isSelectionDisabled"
          :aria-current="workspace.id === workspaceId || undefined"
          @click="handleSelectWorkspace(workspace.id)"
        >
          <WorkspaceProfilePic
            class="size-8 shrink-0 text-sm"
            :workspace-name="workspace.name"
            :subscription-tier="workspace.subscriptionTier"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span
              :title="workspace.name"
              class="truncate text-sm font-medium text-foreground"
            >
              {{ workspace.name }}
            </span>
            <span
              v-if="workspace.planLine"
              class="text-2xs leading-none font-medium text-muted-foreground uppercase"
              data-testid="workspace-row-plan-line"
            >
              {{ workspace.planLine }}
            </span>
          </span>
          <i
            v-if="workspace.id === workspaceId"
            class="icon-[lucide--check] text-foreground"
          />
        </Button>
      </template>
    </div>

    <WorkspaceSwitcherFlyoutFooter @create="emit('create')" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { reportError } from '@comfyorg/telemetry/reportError'
import WorkspaceSwitcherFlyoutFooter from '@/platform/account/components/WorkspaceSwitcherFlyoutFooter.vue'
import { profileMenuPlanLabel } from '@/platform/account/components/profileMenuPlanLine'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import { isCloud } from '@/platform/distribution/types'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const SEARCH_THRESHOLD = 6

const emit = defineEmits<{
  select: []
  create: []
}>()

const { t } = useI18n()
const { switchWorkspace } = useWorkspaceSwitch()
const workspaceStore = useTeamWorkspaceStore()
const billingState = useWorkspaceBillingStateStore()
const {
  workspaceId,
  workspaces,
  isFetchingWorkspaces,
  isSwitching,
  initState
} = storeToRefs(workspaceStore)

const isSelectionDisabled = computed(() => !isCloud && isSwitching.value)

const visibleWorkspaces = computed(() =>
  isFetchingWorkspaces.value
    ? []
    : workspaces.value.map((w) => ({
        id: w.id,
        name: w.name,
        subscriptionTier: billingState.getSummary(w).subscriptionTier,
        planLine: profileMenuPlanLabel(w.plan_summary, t)
      }))
)

const searchQuery = ref('')
const showSearch = computed(
  () => visibleWorkspaces.value.length >= SEARCH_THRESHOLD
)
const filteredWorkspaces = computed(() => {
  const query = showSearch.value ? searchQuery.value.trim().toLowerCase() : ''
  if (!query) return visibleWorkspaces.value
  return visibleWorkspaces.value.filter((w) =>
    w.name.toLowerCase().includes(query)
  )
})

const noMatchQuery = computed(() =>
  filteredWorkspaces.value.length === 0 ? searchQuery.value.trim() : ''
)

const hasLoadError = computed(() => initState.value === 'error')

function retryLoad() {
  workspaceStore.initialize().catch((error: unknown) =>
    reportError(error, {
      errorType: 'error_retrying_workspace_list',
      surface: 'workspace'
    })
  )
}

async function handleSelectWorkspace(id: string) {
  if (await switchWorkspace(id)) emit('select')
}
</script>

<template>
  <div
    v-if="flags.billingNewUxEnabled"
    :class="cn('flex w-60 flex-col gap-1', showSearch && 'pt-1')"
  >
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
        v-else-if="filteredWorkspaces.length === 0 && searchQuery.trim()"
        class="m-0 px-2 py-3 text-sm text-muted-foreground"
      >
        {{ $t('workspaceSwitcher.noResults', { query: searchQuery.trim() }) }}
      </p>

      <template v-else>
        <Button
          v-for="workspace in filteredWorkspaces"
          :key="workspace.id"
          variant="textonly"
          size="unset"
          class="w-full justify-start gap-3 p-1 text-left font-normal"
          :disabled="isSelectionDisabled"
          @click="handleSelectWorkspace(workspace)"
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
            v-if="isCurrentWorkspace(workspace)"
            class="icon-[lucide--check] text-foreground"
          />
        </Button>
      </template>
    </div>

    <template v-if="isCloud">
      <div class="-mx-2 border-t" />
      <Button
        variant="muted-textonly"
        size="unset"
        :disabled="!canCreateWorkspace"
        class="min-h-10 w-full justify-start rounded-lg px-2 py-1 text-left font-normal whitespace-normal"
        data-testid="workspace-switcher-create"
        @click="handleCreateWorkspace"
      >
        <i class="icon-[lucide--plus]" />
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="truncate text-sm">{{
            $t('workspaceSwitcher.createWorkspaceAction')
          }}</span>
          <span
            v-if="createRefusalLine"
            class="text-xs"
            data-testid="workspace-switcher-create-refusal"
            >{{ createRefusalLine }}</span
          >
        </span>
      </Button>
    </template>
    <p v-else class="m-0 px-2 pt-1 text-xs text-muted-foreground">
      {{ $t('workspaceSwitcher.scopeCaption') }}
    </p>
  </div>
  <div v-else class="flex max-h-96 w-80 flex-col overflow-hidden rounded-lg">
    <div
      class="flex scrollbar-custom min-h-0 flex-1 flex-col"
      data-testid="workspace-switcher-list"
    >
      <div v-if="isFetchingWorkspaces" class="flex flex-col gap-2 p-2">
        <div
          v-for="i in 2"
          :key="i"
          class="flex h-[54px] animate-pulse items-center gap-2 rounded-sm px-2 py-4"
        >
          <div class="size-8 rounded-full bg-secondary" />
          <div class="flex flex-1 flex-col gap-1">
            <div class="h-4 w-24 rounded-sm bg-secondary" />
            <div class="h-3 w-16 rounded-sm bg-secondary" />
          </div>
        </div>
      </div>

      <div
        v-for="workspace in visibleWorkspaces"
        :key="workspace.id"
        class="border-b p-2"
      >
        <div
          :data-current="isCurrentWorkspace(workspace)"
          class="group flex h-[54px] w-full items-center gap-2 rounded-sm px-2 py-4 hover:bg-accent data-[current=true]:bg-secondary data-[current=true]:hover:bg-accent"
        >
          <button
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-none bg-transparent p-0"
            :disabled="isSelectionDisabled"
            @click="handleSelectWorkspace(workspace)"
          >
            <WorkspaceProfilePic
              class="size-8 shrink-0 text-sm"
              :workspace-name="workspace.name"
              :subscription-tier="workspace.subscriptionTier"
            />
            <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
              <div class="flex max-w-full min-w-0 items-center gap-1.5">
                <span
                  :title="workspace.name"
                  class="min-w-0 truncate text-sm text-foreground"
                >
                  {{ workspace.name }}
                </span>
                <span
                  v-if="resolveTierLabel(workspace)"
                  class="shrink-0 rounded-full bg-foreground px-1 py-0.5 text-2xs font-bold text-background uppercase"
                >
                  {{ resolveTierLabel(workspace) }}
                </span>
              </div>
              <span class="text-xs text-muted-foreground">
                {{ getRoleLabel(workspace.role) }}
              </span>
            </div>
            <i
              v-if="isCurrentWorkspace(workspace)"
              class="icon-[lucide--check] size-3.5 text-foreground"
            />
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="!isCloud"
      class="flex shrink-0 items-center gap-2 px-4 py-2 text-xs text-muted-foreground"
    >
      <Tooltip>
        <TooltipTrigger
          :aria-label="$t('workspaceSwitcher.scopeCaption')"
          class="flex"
        >
          <i class="icon-[lucide--info] size-3" />
        </TooltipTrigger>
        <TooltipContent side="left">{{
          $t('workspaceSwitcher.scopeTooltip')
        }}</TooltipContent>
      </Tooltip>
      <span>{{ $t('workspaceSwitcher.scopeCaption') }}</span>
    </div>

    <div v-if="isCloud" class="shrink-0 border-t p-2">
      <div
        :class="
          cn(
            'flex h-12 w-full items-center gap-2 rounded-sm p-2',
            canCreateWorkspace
              ? 'cursor-pointer hover:bg-accent'
              : 'cursor-default'
          )
        "
        @click="handleCreateWorkspace"
      >
        <div
          :class="
            cn(
              'flex size-8 items-center justify-center rounded-full bg-secondary',
              !canCreateWorkspace && 'opacity-50'
            )
          "
        >
          <i class="icon-[lucide--plus] size-3.5 text-muted-foreground" />
        </div>
        <div class="flex min-w-0 flex-1 flex-col text-sm text-muted-foreground">
          <span>{{ createWorkspaceLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { profileMenuPlanLabel } from '@/platform/account/components/profileMenuPlanLine'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { isCloud } from '@/platform/distribution/types'
import { useCreateWorkspaceRefusal } from '@/platform/workspace/composables/useCreateWorkspaceRefusal'
import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import { useWorkspaceTierLabel } from '@/platform/billing/composables/useWorkspaceTierLabel'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import type { SubscriptionTier } from '@comfyorg/ingest-types'
import type {
  WorkspaceRole,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

interface AvailableWorkspace {
  id: string
  name: string
  type: WorkspaceType
  role: WorkspaceRole
  isSubscribed: boolean
  subscriptionPlan: string | null
  subscriptionTier: SubscriptionTier | null
  planLine: string | null
}

const emit = defineEmits<{
  select: [workspace: AvailableWorkspace]
  create: []
}>()

const { t } = useI18n()
const { flags } = useFeatureFlags()
const { switchWorkspace } = useWorkspaceSwitch()
const { subscription } = useBillingContext()
const { formatTierName, getTierLabel } = useWorkspaceTierLabel()

const currentSubscriptionTierName = computed(() => {
  const tier = subscription.value?.tier
  if (!tier) return ''
  const isYearly = subscription.value?.duration === 'ANNUAL'
  return formatTierName(tier, isYearly)
})

const workspaceStore = useTeamWorkspaceStore()
const billingState = useWorkspaceBillingStateStore()
const {
  workspaceId,
  workspaces,
  canCreateWorkspace,
  isFetchingWorkspaces,
  isSwitching,
  initState,
  createWorkspaceRefusal,
  maxOwnedWorkspaces
} = storeToRefs(workspaceStore)
const createRefusal = useCreateWorkspaceRefusal()

const isSelectionDisabled = computed(() => !isCloud && isSwitching.value)
const createWorkspaceLabel = computed(() => {
  if (canCreateWorkspace.value) return t('workspaceSwitcher.createWorkspace')
  return createRefusal.value
})

const visibleWorkspaces = computed<AvailableWorkspace[]>(() =>
  isFetchingWorkspaces.value
    ? []
    : workspaces.value.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        role: w.role,
        ...billingState.getSummary(w),
        planLine: profileMenuPlanLabel(w.plan_summary, t)
      }))
)

const SEARCH_THRESHOLD = 6
const searchQuery = ref('')
const showSearch = computed(
  () =>
    !isFetchingWorkspaces.value &&
    visibleWorkspaces.value.length >= SEARCH_THRESHOLD
)
const filteredWorkspaces = computed(() => {
  const query = showSearch.value ? searchQuery.value.trim().toLowerCase() : ''
  if (!query) return visibleWorkspaces.value
  return visibleWorkspaces.value.filter((w) =>
    w.name.toLowerCase().includes(query)
  )
})

const hasLoadError = computed(() => initState.value === 'error')

function retryLoad() {
  workspaceStore.initialize().catch((error: unknown) =>
    reportError(error, {
      errorType: 'error_retrying_workspace_list',
      surface: 'workspace'
    })
  )
}

/** The served refusal under Create workspace; the owned limit gets the short line. */
const createRefusalLine = computed(() => {
  if (
    createWorkspaceRefusal.value === 'owned_workspace_limit' &&
    maxOwnedWorkspaces.value !== undefined
  ) {
    return t('workspaceSwitcher.ownedLimit', { max: maxOwnedWorkspaces.value })
  }
  return createRefusal.value
})

function isCurrentWorkspace(workspace: AvailableWorkspace): boolean {
  return workspace.id === workspaceId.value
}

function getRoleLabel(role: AvailableWorkspace['role']): string {
  if (role === 'owner') return t('workspaceSwitcher.roleOwner')
  if (role === 'member') return t('workspaceSwitcher.roleMember')
  return ''
}

function resolveTierLabel(workspace: AvailableWorkspace): string | null {
  if (workspace.type !== 'personal') return null

  if (isCurrentWorkspace(workspace)) {
    return currentSubscriptionTierName.value || null
  }

  return getTierLabel(workspace)
}

async function handleSelectWorkspace(workspace: AvailableWorkspace) {
  const success = await switchWorkspace(workspace.id)
  if (success) {
    emit('select', workspace)
  }
}

function handleCreateWorkspace() {
  if (canCreateWorkspace.value) emit('create')
}
</script>

<template>
  <section
    class="flex min-h-0 grow flex-col gap-6 overflow-auto"
    aria-labelledby="partner-node-access-title"
  >
    <h2 id="partner-node-access-title" class="sr-only">
      {{ $t('workspacePanel.partnerNodes.title') }}
    </h2>

    <div
      class="flex items-start gap-4 rounded-2xl border border-interface-stroke p-4 font-inter"
    >
      <span class="shrink-0" @click.prevent="requestAccessModeToggle">
        <Switch
          :model-value="!isRestricted"
          readonly
          :disabled="!isGated && (!canEditPolicy || isSaving)"
          :aria-label="$t('workspacePanel.partnerNodes.accessMode')"
          :class="
            cn('transition-transform active:scale-90', isGated && 'opacity-60')
          "
        />
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex h-6 items-center gap-2">
          <p
            class="m-0 text-sm leading-[normal] font-normal text-base-foreground"
          >
            {{ $t('workspacePanel.partnerNodes.allowAll') }}
          </p>
          <span
            v-if="isGated"
            class="rounded-full bg-secondary-background px-2 py-0.5 text-xs text-base-foreground"
          >
            {{ $t('workspacePanel.partnerNodes.enterpriseBadge') }}
          </span>
        </div>
        <p
          v-if="isGated"
          class="m-0 mt-1 text-sm leading-[normal] font-normal text-muted-foreground"
        >
          {{ $t('workspacePanel.partnerNodes.gatedHint') }}
        </p>
        <p
          v-else-if="isPolicyLoaded && !isRestricted"
          class="m-0 mt-1 text-sm leading-[normal] font-normal text-muted-foreground"
        >
          {{ $t('workspacePanel.partnerNodes.allowAllOnHint') }}
        </p>
        <p
          v-else-if="isPolicyLoaded"
          class="m-0 mt-1 flex items-center gap-2 text-sm/4 font-normal text-muted-foreground"
        >
          <i
            class="icon-[lucide--circle-alert] size-4 shrink-0 text-warning-background"
            aria-hidden="true"
          />
          <span>{{ $t('workspacePanel.partnerNodes.allowAllOffHint') }}</span>
        </p>
      </div>
      <Button
        v-if="isGated"
        variant="inverted"
        size="lg"
        class="shrink-0 self-center"
        @click="openEnterprisePage"
      >
        {{ $t('workspacePanel.partnerNodes.contactUs') }}
      </Button>
    </div>

    <p v-if="isReadOnly" class="text-sm text-muted-foreground">
      {{ $t('workspacePanel.partnerNodes.ownerOnly') }}
    </p>

    <div
      v-if="status === 'loading'"
      :aria-label="$t('workspacePanel.partnerNodes.loading')"
      class="space-y-3"
    >
      <Skeleton class="h-10 w-full" />
      <Skeleton v-for="index in 5" :key="index" class="h-12 w-full" />
    </div>

    <div
      v-else-if="status === 'error'"
      role="alert"
      class="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-interface-stroke p-6 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{ $t('workspacePanel.partnerNodes.loadError') }}
      </p>
      <Button variant="secondary" @click="loadPolicy">
        {{ $t('workspacePanel.partnerNodes.retry') }}
      </Button>
    </div>

    <div
      v-else-if="(status === 'ineligible' && !isGated) || status === 'inactive'"
      role="status"
      class="flex min-h-48 items-center justify-center rounded-2xl border border-interface-stroke p-6 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{ $t('workspacePanel.partnerNodes.unavailable') }}
      </p>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <label class="w-full max-w-64">
          <span class="sr-only">
            {{ $t('workspacePanel.partnerNodes.searchPlaceholder') }}
          </span>
          <SearchInput
            v-model="searchQuery"
            :placeholder="$t('workspacePanel.partnerNodes.searchPlaceholder')"
            size="lg"
            class="w-full"
          />
        </label>
        <DropdownMenu
          v-if="isRestricted"
          :entries="bulkMenuEntries"
          :modal="false"
        >
          <template #button>
            <Button
              variant="secondary"
              size="lg"
              :disabled="isSaving || !canEditPolicy"
            >
              {{ $t('workspacePanel.partnerNodes.disableAll') }}
              <i
                class="icon-[lucide--chevron-down] size-4"
                aria-hidden="true"
              />
            </Button>
          </template>
        </DropdownMenu>
      </div>

      <p
        v-if="saveError"
        role="alert"
        class="rounded-lg bg-destructive-background/10 px-4 py-3 text-sm text-destructive-background"
      >
        {{ $t('workspacePanel.partnerNodes.saveError') }}
      </p>

      <div
        role="table"
        :aria-label="$t('workspacePanel.partnerNodes.tableLabel')"
        class="flex min-h-0 grow flex-col rounded-2xl border border-interface-stroke px-4 py-3"
      >
        <div class="min-h-0 grow scrollbar-gutter-stable overflow-y-auto">
          <div
            role="row"
            :class="
              cn(
                'sticky -top-px z-10 grid h-10 items-center gap-2 border-b border-border-default bg-base-background px-2 text-sm text-muted-foreground',
                rowGridClass
              )
            "
          >
            <span
              role="columnheader"
              :aria-sort="sortField === 'provider' ? sortDirection : 'none'"
            >
              <Button
                variant="textonly"
                size="unset"
                class="-m-2 gap-2 p-2 text-sm font-normal text-muted-foreground"
                @click="sortBy('provider')"
              >
                {{ $t('workspacePanel.partnerNodes.columns.provider') }}
                <i
                  :class="
                    cn('size-4 transition-transform', sortIcon('provider'))
                  "
                  aria-hidden="true"
                />
              </Button>
            </span>
            <span
              role="columnheader"
              :aria-sort="sortField === 'models' ? sortDirection : 'none'"
              class="hidden lg:block"
            >
              <Button
                variant="textonly"
                size="unset"
                class="-m-2 gap-2 p-2 text-sm font-normal text-muted-foreground"
                @click="sortBy('models')"
              >
                {{ $t('workspacePanel.partnerNodes.columns.models') }}
                <i
                  :class="cn('size-4 transition-transform', sortIcon('models'))"
                  aria-hidden="true"
                />
              </Button>
            </span>
            <span
              role="columnheader"
              :aria-sort="sortField === 'state' ? sortDirection : 'none'"
              class="hidden lg:flex lg:justify-end"
            >
              <Button
                v-if="isRestricted"
                variant="textonly"
                size="unset"
                class="-m-2 gap-2 p-2 text-sm font-normal text-muted-foreground"
                @click="sortBy('state')"
              >
                {{ $t('workspacePanel.partnerNodes.columns.state') }}
                <i
                  :class="cn('size-4 transition-transform', sortIcon('state'))"
                  aria-hidden="true"
                />
              </Button>
            </span>
          </div>

          <template v-for="provider in sortedProviders" :key="provider.id">
            <div
              role="row"
              :class="
                cn(
                  'grid h-10 items-center gap-2 border-b border-secondary-background px-2 last:border-b-0 hover:bg-secondary-background/40',
                  rowGridClass
                )
              "
            >
              <div role="cell" class="min-w-0">
                <Button
                  variant="textonly"
                  size="unset"
                  class="h-10 w-full justify-start gap-2 p-0 text-left font-normal hover:bg-transparent"
                  :aria-expanded="isProviderExpanded(provider)"
                  @click="toggleExpanded(provider.id)"
                >
                  <i
                    :class="
                      cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform',
                        'icon-[lucide--chevron-down]',
                        !isProviderExpanded(provider) && '-rotate-90'
                      )
                    "
                    aria-hidden="true"
                  />
                  <span
                    class="flex size-5 shrink-0 items-center justify-center rounded-full bg-interface-panel-hover-surface"
                    aria-hidden="true"
                  >
                    <i
                      :class="
                        cn(
                          getProviderIcon(
                            provider.nodeCategories[0] ?? provider.displayName
                          ),
                          'size-3'
                        )
                      "
                    />
                  </span>
                  <span class="truncate">{{ provider.displayName }}</span>
                </Button>
              </div>
              <span
                role="cell"
                class="hidden text-sm text-muted-foreground lg:block"
              >
                {{
                  provider.totalModelCount !== undefined &&
                  provider.nodes.length < provider.totalModelCount
                    ? $t(
                        'workspacePanel.partnerNodes.matchedModelCount',
                        {
                          matched: provider.nodes.length,
                          total: provider.totalModelCount
                        },
                        provider.nodes.length
                      )
                    : $t(
                        'workspacePanel.partnerNodes.modelCount',
                        provider.nodes.length
                      )
                }}
              </span>
              <div
                role="cell"
                class="flex h-8 items-center justify-end justify-self-end"
              >
                <Switch
                  v-if="isRestricted"
                  :model-value="provider.enabled"
                  :disabled="isSaving || !canEditPolicy"
                  :aria-label="
                    $t('workspacePanel.partnerNodes.toggleProvider', {
                      provider: provider.displayName
                    })
                  "
                  class="transition-transform active:scale-90"
                  @update:model-value="saveProviderChange(provider.id, $event)"
                />
              </div>
            </div>

            <div
              v-for="node in isProviderExpanded(provider) ? provider.nodes : []"
              :key="node.id"
              role="row"
              :class="
                cn(
                  'grid h-10 items-center gap-2 border-b border-secondary-background px-2 text-sm last:border-b-0',
                  rowGridClass
                )
              "
            >
              <span role="cell" class="truncate pl-17 text-muted-foreground">
                {{ node.name }}
              </span>
              <span role="cell" class="hidden lg:block" />
              <span role="cell" />
            </div>
          </template>

          <div
            v-if="sortedProviders.length === 0"
            class="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground"
          >
            {{ $t('workspacePanel.partnerNodes.noResults') }}
          </div>
        </div>

        <div
          v-if="sortedProviders.length > 0"
          class="mt-2 flex shrink-0 justify-end border-t border-border-default px-2 pt-3 text-sm text-base-foreground"
        >
          <i18n-t
            keypath="workspacePanel.partnerNodes.allowedSummary"
            tag="span"
            scope="global"
          >
            <template #count>
              <span class="font-bold">{{
                isRestricted
                  ? enabledModelCount
                  : $t('workspacePanel.partnerNodes.allowedSummaryAll')
              }}</span>
            </template>
          </i18n-t>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MenuItem } from '@/components/ui/menu/types'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import DropdownMenu from '@/components/common/DropdownMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getProviderIcon, getProviderName } from '@/utils/categoryUtil'
import { cn } from '@comfyorg/tailwind-utils'

const governanceStore = usePartnerNodeGovernanceStore()
const { governedWorkspaceId, isSaving, policy, providers, status } =
  storeToRefs(governanceStore)
const {
  isProviderEnabled,
  loadPolicy,
  setAllProvidersEnabled,
  setEnforcementEnabled,
  setProviderEnabled,
  setProvidersEnabled
} = governanceStore
const nodeDefStore = useNodeDefStore()
const { nodeDefsByName } = storeToRefs(nodeDefStore)
const dialogStore = useDialogStore()
const { workspaceRole } = useWorkspaceUI()
const { t } = useI18n()

const searchQuery = ref('')
const isSearching = computed(() => searchQuery.value.trim().length > 0)
const expandedProviderIds = ref(new Set<string>())
const saveError = ref(false)
type SortDirection = 'ascending' | 'descending'
type SortField = 'provider' | 'models' | 'state'

const sortField = ref<SortField>('provider')
const sortDirection = ref<SortDirection>('ascending')

const isRestricted = computed(() => policy.value?.enforcementEnabled === true)
const isPolicyLoaded = computed(
  () => status.value === 'configured' || status.value === 'unconfigured'
)
const isGated = computed(
  () => status.value === 'ineligible' && providers.value.length > 0
)
const isReadOnly = computed(() => workspaceRole.value !== 'owner')
const canEditPolicy = computed(() => !isReadOnly.value && isPolicyLoaded.value)

const rowGridClass =
  'grid-cols-[minmax(0,1fr)_2.5rem] lg:grid-cols-[minmax(0,1fr)_12rem_5rem]'

const providerRows = computed(() =>
  providers.value
    .filter(({ nodeCategories }) => nodeCategories.length > 0)
    .map((provider) => {
      const nodes = Object.values(nodeDefsByName.value)
        .filter(
          (nodeDef) =>
            nodeDef.api_node &&
            provider.nodeCategories.includes(getProviderName(nodeDef.category))
        )
        .map((nodeDef) => ({
          id: nodeDef.name,
          name: nodeDef.display_name || nodeDef.name
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      return {
        ...provider,
        enabled: isProviderEnabled(provider.id),
        nodes
      }
    })
)

const enabledModelCount = computed(() =>
  providerRows.value.reduce(
    (total, { enabled, nodes }) => total + (enabled ? nodes.length : 0),
    0
  )
)

type FilteredProvider = (typeof providerRows)['value'][number] & {
  totalModelCount?: number
}

const filteredProviders = computed<FilteredProvider[]>(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return providerRows.value

  return providerRows.value.flatMap((provider): FilteredProvider[] => {
    if (provider.displayName.toLocaleLowerCase().includes(query)) {
      return [provider]
    }

    const nodes = provider.nodes.filter(({ name }) =>
      name.toLocaleLowerCase().includes(query)
    )
    return nodes.length > 0
      ? [{ ...provider, nodes, totalModelCount: provider.nodes.length }]
      : []
  })
})

const bulkMenuEntries = computed<MenuItem[]>(() => {
  const rows = filteredProviders.value
  const providerIds = rows.map(({ id }) => id)
  const locked = isSaving.value || !canEditPolicy.value || rows.length === 0

  return [
    {
      label: isSearching.value
        ? t('workspacePanel.partnerNodes.disableMatchingCount', rows.length)
        : t('workspacePanel.partnerNodes.disableAllCount', rows.length),
      disabled: locked || rows.every(({ enabled }) => !enabled),
      command: () => handleBulkDisable(providerIds)
    },
    {
      label: isSearching.value
        ? t('workspacePanel.partnerNodes.enableMatchingCount', rows.length)
        : t('workspacePanel.partnerNodes.enableAllCount', rows.length),
      disabled: locked || rows.every(({ enabled }) => enabled),
      command: () =>
        void performSave(() => setProvidersEnabled(providerIds, true))
    }
  ]
})

const sortedProviders = computed(() =>
  [...filteredProviders.value].sort((a, b) => {
    const result =
      sortField.value === 'provider'
        ? a.displayName.localeCompare(b.displayName)
        : sortField.value === 'models'
          ? a.nodes.length - b.nodes.length
          : Number(a.enabled) - Number(b.enabled)
    const directedResult =
      sortDirection.value === 'ascending' ? result : -result
    return directedResult || a.displayName.localeCompare(b.displayName)
  })
)

function sortBy(field: SortField) {
  if (sortField.value === field) {
    sortDirection.value =
      sortDirection.value === 'ascending' ? 'descending' : 'ascending'
    return
  }

  sortField.value = field
  sortDirection.value = field === 'provider' ? 'ascending' : 'descending'
}

function sortIcon(field: SortField) {
  return cn(
    sortField.value === field
      ? 'icon-[lucide--arrow-down]'
      : 'icon-[lucide--arrow-up-down]',
    sortField.value === field &&
      sortDirection.value === 'descending' &&
      'rotate-180'
  )
}

function toggleExpanded(providerId: string) {
  const nextIds = new Set(expandedProviderIds.value)
  if (nextIds.has(providerId)) nextIds.delete(providerId)
  else nextIds.add(providerId)
  expandedProviderIds.value = nextIds
}

function isProviderExpanded(provider: { id: string }) {
  return expandedProviderIds.value.has(provider.id)
}

async function performSave(action: () => Promise<void>) {
  saveError.value = false
  try {
    await action()
  } catch {
    saveError.value = true
  }
}

function saveProviderChange(providerId: string, enabled: boolean) {
  void performSave(() => setProviderEnabled(providerId, enabled))
}

function handleBulkDisable(providerIds: string[]) {
  if (isSearching.value) {
    void performSave(() => setProvidersEnabled(providerIds, false))
    return
  }
  confirmDisableAll()
}

function createPolicyConfirmationGuard() {
  const sourceWorkspaceId = governedWorkspaceId.value
  const sourcePolicy = policy.value
  if (!sourceWorkspaceId) return null

  return () =>
    workspaceRole.value === 'owner' &&
    governedWorkspaceId.value === sourceWorkspaceId &&
    policy.value === sourcePolicy
}

function confirmDisableAll() {
  const canConfirm = createPolicyConfirmationGuard()
  if (!canConfirm) return

  const dialog = showConfirmDialog({
    headerProps: { title: t('workspacePanel.partnerNodes.disableAllTitle') },
    props: { promptText: t('workspacePanel.partnerNodes.disableAllMessage') },
    footerProps: {
      confirmText: t('workspacePanel.partnerNodes.disableAll'),
      confirmVariant: 'destructive',
      optionsDisabled: isSaving,
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        if (!canConfirm()) {
          dialogStore.closeDialog(dialog)
          return
        }
        await performSave(() => setAllProvidersEnabled(false))
        dialogStore.closeDialog(dialog)
      }
    }
  })
}

function requestAccessModeToggle() {
  if (isGated.value) {
    confirmEnterpriseUpsell()
    return
  }
  if (!canEditPolicy.value || isSaving.value) return

  const enabled = !isRestricted.value
  confirmAccessModeChange(enabled, () => setEnforcementEnabled(enabled))
}

function openEnterprisePage() {
  window.open('https://comfy.org/cloud/enterprise/', '_blank')
}

function confirmEnterpriseUpsell() {
  const dialog = showConfirmDialog({
    headerProps: {
      title: t('workspacePanel.partnerNodes.gatedDialogTitle')
    },
    props: {
      promptText: t('workspacePanel.partnerNodes.gatedDialogMessage')
    },
    footerProps: {
      cancelText: t('workspacePanel.partnerNodes.notNow'),
      confirmText: t('workspacePanel.partnerNodes.contactUs'),
      confirmVariant: 'inverted',
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: () => {
        openEnterprisePage()
        dialogStore.closeDialog(dialog)
      }
    }
  })
}

function confirmAccessModeChange(
  enabled: boolean,
  action: () => Promise<void>
) {
  const canConfirm = createPolicyConfirmationGuard()
  if (!canConfirm) return

  const key = enabled ? 'restrictAccess' : 'allowAllAccess'
  const dialog = showConfirmDialog({
    headerProps: {
      title: t(`workspacePanel.partnerNodes.${key}Title`)
    },
    props: {
      promptText: `${t(`workspacePanel.partnerNodes.${key}Message`)} ${t(
        `workspacePanel.partnerNodes.${key}Hint`
      )}`
    },
    footerProps: {
      confirmText: t('g.confirm'),
      confirmVariant: 'secondary',
      optionsDisabled: isSaving,
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        if (!canConfirm()) {
          dialogStore.closeDialog(dialog)
          return
        }
        await performSave(action)
        dialogStore.closeDialog(dialog)
      }
    }
  })
}
</script>

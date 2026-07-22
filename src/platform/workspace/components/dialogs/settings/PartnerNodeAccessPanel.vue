<template>
  <section
    v-if="status !== 'ineligible' && status !== 'inactive'"
    class="flex min-h-0 grow flex-col gap-6 overflow-auto"
    aria-labelledby="partner-node-access-title"
  >
    <div
      class="flex min-h-20 items-center justify-between gap-2 rounded-2xl bg-secondary-background px-4 py-3 font-inter"
    >
      <div class="min-w-0 flex-1">
        <h2
          id="partner-node-access-title"
          class="m-0 truncate text-sm leading-[normal] font-normal text-base-foreground"
        >
          {{ $t('workspacePanel.partnerNodes.title') }}
        </h2>
        <p
          v-if="isPolicyLoaded"
          class="m-0 mt-2 truncate text-sm leading-[normal] font-normal text-muted-foreground"
        >
          {{
            $t(
              isRestricted
                ? 'workspacePanel.partnerNodes.restrictedDescription'
                : 'workspacePanel.partnerNodes.unrestrictedDescription'
            )
          }}
        </p>
      </div>
      <RadioGroupRoot
        v-if="isPolicyLoaded"
        :model-value="isRestricted ? 'restricted' : 'unrestricted'"
        orientation="horizontal"
        :disabled="isSaving || !canEditPolicy"
        :aria-label="$t('workspacePanel.partnerNodes.accessMode')"
        class="flex w-48 gap-1 rounded-lg bg-secondary-background-hover p-1"
        @update:model-value="requestEnforcementMode($event === 'restricted')"
      >
        <RadioGroupItem
          value="unrestricted"
          :class="
            cn(
              buttonVariants({ variant: 'textonly' }),
              'flex-1 px-2 leading-[normal] font-normal',
              !isRestricted &&
                'bg-base-foreground text-base-background hover:bg-base-foreground'
            )
          "
        >
          {{ $t('workspacePanel.partnerNodes.unrestricted') }}
        </RadioGroupItem>
        <RadioGroupItem
          value="restricted"
          :class="
            cn(
              buttonVariants({ variant: 'textonly' }),
              'flex-1 px-2 leading-[normal] font-normal',
              isRestricted &&
                'bg-base-foreground text-base-background hover:bg-base-foreground'
            )
          "
        >
          {{ $t('workspacePanel.partnerNodes.restricted') }}
        </RadioGroupItem>
      </RadioGroupRoot>
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
        <div class="flex items-center gap-2">
          <Button
            v-if="!allProvidersEnabled"
            variant="textonly"
            size="lg"
            :loading="pendingBulkAction === 'enable'"
            :disabled="isSaving || !canEditPolicy"
            @click="handleEnableAll"
          >
            {{ $t('workspacePanel.partnerNodes.enableAll') }}
          </Button>
          <Button
            v-else
            variant="textonly"
            size="lg"
            :disabled="!isRestricted || isSaving || !canEditPolicy"
            @click="confirmDisableAll"
          >
            {{ $t('workspacePanel.partnerNodes.disableAll') }}
          </Button>
        </div>
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
        :aria-disabled="!isRestricted"
        :inert="!isRestricted"
        :class="
          cn(
            'min-h-0 overflow-auto rounded-2xl border border-interface-stroke px-4 py-3',
            !isRestricted && 'pointer-events-none opacity-50'
          )
        "
      >
        <div
          role="row"
          class="grid h-10 grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 px-2 text-sm text-muted-foreground lg:grid-cols-[minmax(0,1fr)_12rem_10rem_2.5rem]"
        >
          <span
            role="columnheader"
            :aria-sort="sortField === 'provider' ? sortDirection : 'none'"
          >
            <Button
              variant="textonly"
              size="unset"
              class="gap-2 p-0 text-sm font-normal text-muted-foreground"
              @click="sortBy('provider')"
            >
              {{ $t('workspacePanel.partnerNodes.columns.provider') }}
              <i
                :class="
                  cn(
                    'size-4 transition-transform',
                    sortField === 'provider'
                      ? 'icon-[lucide--arrow-down]'
                      : 'icon-[lucide--arrow-up-down]',
                    sortField === 'provider' &&
                      sortDirection === 'descending' &&
                      'rotate-180'
                  )
                "
                aria-hidden="true"
              />
            </Button>
          </span>
          <span
            role="columnheader"
            :aria-sort="sortField === 'nodes' ? sortDirection : 'none'"
            class="hidden lg:block"
          >
            <Button
              variant="textonly"
              size="unset"
              class="gap-2 p-0 text-sm font-normal text-muted-foreground"
              @click="sortBy('nodes')"
            >
              {{ $t('workspacePanel.partnerNodes.columns.nodes') }}
              <i
                :class="
                  cn(
                    'size-4 transition-transform',
                    sortField === 'nodes'
                      ? 'icon-[lucide--arrow-down]'
                      : 'icon-[lucide--arrow-up-down]',
                    sortField === 'nodes' &&
                      sortDirection === 'descending' &&
                      'rotate-180'
                  )
                "
                aria-hidden="true"
              />
            </Button>
          </span>
          <span role="columnheader" aria-sort="none" class="hidden lg:block">
            <span class="flex items-center gap-2">
              {{ $t('workspacePanel.partnerNodes.columns.lastModified') }}
              <i
                class="icon-[lucide--arrow-up-down] size-4"
                aria-hidden="true"
              />
            </span>
          </span>
          <span role="columnheader" />
        </div>

        <div aria-hidden="true" class="my-2 border-t border-border-default" />

        <template v-for="provider in sortedProviders" :key="provider.id">
          <div
            role="row"
            class="grid h-10 grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-secondary-background px-2 last:border-b-0 hover:bg-secondary-background/40 lg:grid-cols-[minmax(0,1fr)_12rem_10rem_2.5rem]"
          >
            <div role="cell" class="min-w-0">
              <Button
                variant="textonly"
                size="unset"
                class="h-10 w-full justify-start gap-2 p-0 text-left font-normal hover:bg-transparent"
                :aria-expanded="isProviderExpanded(provider.id)"
                @click="toggleExpanded(provider.id)"
              >
                <i
                  :class="
                    cn(
                      'size-4 shrink-0 transition-transform',
                      'icon-[lucide--chevron-down]',
                      !isProviderExpanded(provider.id) && '-rotate-90'
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
                $t(
                  'workspacePanel.partnerNodes.nodeCount',
                  provider.enabled ? provider.nodes.length : 0
                )
              }}
            </span>
            <span
              role="cell"
              class="hidden text-sm text-muted-foreground lg:block"
            >
              --
            </span>
            <div
              role="cell"
              class="flex h-8 w-10 items-center justify-end justify-self-end"
            >
              <ToggleSwitch
                :model-value="provider.enabled"
                :disabled="!isRestricted || isSaving || !canEditPolicy"
                :aria-label="
                  $t('workspacePanel.partnerNodes.toggleProvider', {
                    provider: provider.displayName
                  })
                "
                class="transition-transform active:scale-90"
                @update:model-value="handleProviderChange(provider.id, $event)"
              />
            </div>
          </div>

          <div
            v-for="node in isProviderExpanded(provider.id)
              ? provider.nodes
              : []"
            :key="node.id"
            role="row"
            class="grid h-10 grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-secondary-background bg-secondary-background/40 px-2 text-sm last:border-b-0 lg:grid-cols-[minmax(0,1fr)_12rem_10rem_2.5rem]"
          >
            <span role="cell" class="truncate pl-17 text-muted-foreground">
              {{ node.name }}
            </span>
            <span role="cell" class="hidden lg:block" />
            <span role="cell" class="hidden text-muted-foreground lg:block">
              --
            </span>
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
    </template>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ToggleSwitch from 'primevue/toggleswitch'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import Button from '@/components/ui/button/Button.vue'
import { buttonVariants } from '@/components/ui/button/button.variants'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
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
  setProviderEnabled
} = governanceStore
const nodeDefStore = useNodeDefStore()
const { nodeDefsByName } = storeToRefs(nodeDefStore)
const dialogStore = useDialogStore()
const { workspaceRole } = useWorkspaceUI()
const { t } = useI18n()

const searchQuery = ref('')
const expandedProviderIds = ref(new Set<string>())
const pendingBulkAction = ref<'enable' | null>(null)
const saveError = ref(false)
type SortDirection = 'ascending' | 'descending'
type SortField = 'provider' | 'nodes'

const sortField = ref<SortField>('provider')
const sortDirection = ref<SortDirection>('ascending')

const isRestricted = computed(() => policy.value?.enforcementEnabled === true)
const isPolicyLoaded = computed(
  () => status.value === 'configured' || status.value === 'unconfigured'
)
const isReadOnly = computed(() => workspaceRole.value !== 'owner')
const canEditPolicy = computed(() => !isReadOnly.value && isPolicyLoaded.value)
const allProvidersEnabled = computed(() =>
  providers.value.every(({ id }) => isProviderEnabled(id))
)

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

const filteredProviders = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return providerRows.value

  return providerRows.value
    .map((provider) => {
      if (provider.displayName.toLocaleLowerCase().includes(query)) {
        return provider
      }
      return {
        ...provider,
        nodes: provider.nodes.filter(({ name }) =>
          name.toLocaleLowerCase().includes(query)
        )
      }
    })
    .filter(
      ({ displayName, nodes }) =>
        displayName.toLocaleLowerCase().includes(query) || nodes.length > 0
    )
})

const sortedProviders = computed(() =>
  [...filteredProviders.value].sort((a, b) => {
    const result =
      sortField.value === 'provider'
        ? a.displayName.localeCompare(b.displayName)
        : Number(a.enabled) * a.nodes.length -
          Number(b.enabled) * b.nodes.length
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

function toggleExpanded(providerId: string) {
  const nextIds = new Set(expandedProviderIds.value)
  if (nextIds.has(providerId)) nextIds.delete(providerId)
  else nextIds.add(providerId)
  expandedProviderIds.value = nextIds
}

function isProviderExpanded(providerId: string) {
  return (
    searchQuery.value.trim().length > 0 ||
    expandedProviderIds.value.has(providerId)
  )
}

async function performSave(action: () => Promise<void>) {
  saveError.value = false
  try {
    await action()
  } catch {
    saveError.value = true
  }
}

function handleProviderChange(providerId: string, enabled: boolean) {
  const saveProviderChange = () => setProviderEnabled(providerId, enabled)
  if (enabled || isRestricted.value) {
    void performSave(saveProviderChange)
    return
  }
  confirmAccessModeChange(true, saveProviderChange)
}

async function handleEnableAll() {
  pendingBulkAction.value = 'enable'
  await performSave(() => setAllProvidersEnabled(true))
  pendingBulkAction.value = null
}

function confirmDisableAll() {
  const dialog = showConfirmDialog({
    headerProps: { title: t('workspacePanel.partnerNodes.disableAllTitle') },
    props: { promptText: t('workspacePanel.partnerNodes.disableAllMessage') },
    footerProps: {
      confirmText: t('workspacePanel.partnerNodes.disableAll'),
      confirmVariant: 'destructive',
      optionsDisabled: isSaving,
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        await performSave(() => setAllProvidersEnabled(false))
        dialogStore.closeDialog(dialog)
      }
    }
  })
}

function requestEnforcementMode(enabled: boolean) {
  if (enabled === isRestricted.value) return
  if (!enabled && allProvidersEnabled.value) {
    void performSave(() => setEnforcementEnabled(false))
    return
  }

  confirmAccessModeChange(enabled, () => setEnforcementEnabled(enabled))
}

function confirmAccessModeChange(
  enabled: boolean,
  action: () => Promise<void>
) {
  const sourceWorkspaceId = governedWorkspaceId.value
  const sourcePolicy = policy.value
  if (!sourceWorkspaceId) return

  const copy = enabled
    ? {
        title: t('workspacePanel.partnerNodes.restrictAccessTitle'),
        message: t('workspacePanel.partnerNodes.restrictAccessMessage'),
        hint: t('workspacePanel.partnerNodes.restrictAccessHint')
      }
    : {
        title: t('workspacePanel.partnerNodes.allowAllAccessTitle'),
        message: t('workspacePanel.partnerNodes.allowAllAccessMessage'),
        hint: t('workspacePanel.partnerNodes.allowAllAccessHint')
      }
  const dialog = showConfirmDialog({
    headerProps: { title: copy.title },
    props: {
      promptText: `${copy.message}\n\n${copy.hint}`,
      preserveNewlines: true
    },
    footerProps: {
      confirmText: t('g.confirm'),
      confirmVariant: 'primary',
      optionsDisabled: isSaving,
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        if (
          governedWorkspaceId.value !== sourceWorkspaceId ||
          policy.value !== sourcePolicy
        ) {
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

<template>
  <section
    v-if="status !== 'ineligible' && status !== 'inactive'"
    class="flex min-h-0 grow flex-col gap-6 overflow-auto"
    aria-labelledby="partner-node-access-title"
  >
    <div
      class="flex min-h-20 flex-wrap items-center justify-between gap-4 rounded-lg border border-interface-stroke bg-secondary-background px-4 py-3"
    >
      <div class="max-w-2xl">
        <h2
          id="partner-node-access-title"
          class="text-sm font-semibold text-base-foreground"
        >
          {{ $t('workspacePanel.partnerNodes.title') }}
        </h2>
        <p v-if="isPolicyLoaded" class="mt-1 text-sm text-muted-foreground">
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
        class="flex rounded-lg bg-secondary-background p-1"
        @update:model-value="requestEnforcementMode($event === 'restricted')"
      >
        <RadioGroupItem
          value="unrestricted"
          :class="
            cn(
              buttonVariants({ variant: 'textonly' }),
              'px-3',
              !isRestricted && 'bg-base-background hover:bg-base-background'
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
              'px-3',
              isRestricted && 'bg-base-background hover:bg-base-background'
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
            variant="secondary"
            :loading="pendingBulkAction === 'enable'"
            :disabled="isSaving || !canEditPolicy"
            @click="handleEnableAll"
          >
            {{ $t('workspacePanel.partnerNodes.enableAll') }}
          </Button>
          <Button
            v-else
            variant="secondary"
            :disabled="isSaving || !canEditPolicy"
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
        class="min-h-0 overflow-auto rounded-2xl border border-interface-stroke"
      >
        <div
          role="row"
          class="grid grid-cols-[minmax(0,1fr)_3rem] items-center border-b border-interface-stroke px-4 py-3 text-xs font-medium text-muted-foreground lg:grid-cols-[minmax(0,1fr)_8rem_10rem_3rem]"
        >
          <span role="columnheader">
            {{ $t('workspacePanel.partnerNodes.columns.provider') }}
          </span>
          <span role="columnheader" class="hidden lg:block">
            {{ $t('workspacePanel.partnerNodes.columns.nodes') }}
          </span>
          <span role="columnheader" class="hidden lg:block">
            {{ $t('workspacePanel.partnerNodes.columns.lastModified') }}
          </span>
          <span role="columnheader" />
        </div>

        <template v-for="provider in filteredProviders" :key="provider.id">
          <div
            role="row"
            class="grid grid-cols-[minmax(0,1fr)_3rem] items-center border-b border-interface-stroke px-4 py-2 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_8rem_10rem_3rem]"
          >
            <div role="cell" class="min-w-0">
              <Button
                variant="textonly"
                size="unset"
                class="w-full justify-start p-2 text-left"
                :aria-expanded="isProviderExpanded(provider.id)"
                @click="toggleExpanded(provider.id)"
              >
                <i
                  :class="
                    cn(
                      'size-4 shrink-0 transition-transform',
                      isProviderExpanded(provider.id) && 'rotate-90',
                      'icon-[lucide--chevron-right]'
                    )
                  "
                />
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
            <div role="cell" class="flex items-center justify-end">
              <SwitchRoot
                :model-value="provider.enabled"
                :disabled="isSaving || !canEditPolicy"
                :aria-label="
                  $t('workspacePanel.partnerNodes.toggleProvider', {
                    provider: provider.displayName
                  })
                "
                class="focus-visible:ring-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-secondary-background outline-hidden transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary-background"
                @update:model-value="handleProviderChange(provider.id, $event)"
              >
                <SwitchThumb
                  class="block size-4 translate-x-0.5 rounded-full bg-base-foreground transition-transform data-[state=checked]:translate-x-4"
                />
              </SwitchRoot>
            </div>
          </div>

          <div
            v-for="node in isProviderExpanded(provider.id)
              ? provider.nodes
              : []"
            :key="node.id"
            role="row"
            class="grid grid-cols-[minmax(0,1fr)_3rem] items-center border-b border-interface-stroke bg-secondary-background/40 px-4 py-3 text-sm last:border-b-0 lg:grid-cols-[minmax(0,1fr)_8rem_10rem_3rem]"
          >
            <span role="cell" class="truncate pl-10 text-muted-foreground">
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
          v-if="filteredProviders.length === 0"
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

import {
  RadioGroupItem,
  RadioGroupRoot,
  SwitchRoot,
  SwitchThumb
} from 'reka-ui'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import Button from '@/components/ui/button/Button.vue'
import { buttonVariants } from '@/components/ui/button/button.variants'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getProviderName } from '@/utils/categoryUtil'
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
